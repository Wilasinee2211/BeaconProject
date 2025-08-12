const mqtt  = require('mqtt');
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');

// ===========================
//  CONFIGURATION
// ===========================

// MQTT Broker (TLS/SSL)
const MQTT_SERVER   = "mqtts://1723070ff8c842a18f954078cd5289af.s1.eu.hivemq.cloud";
const MQTT_USERNAME = "test1";
const MQTT_PASSWORD = "Test12345";
const MQTT_TOPIC    = "ble/ibeacons";
const CONTROL_TOPIC = "ble/commands";

// MySQL Database
const MYSQL_CONFIG = {
  host:     'localhost',
  port:     8889,
  user:     'root',
  password: 'root',
  database: 'beacon_db',
};

// Sliding Window Parameters
const WINDOW_SIZE = 10;
const STEP_SIZE   = 5;

// Buffer RSSI
const buffers = {};

function makeKey(host, uuid) {
  return `${host}|${uuid}`;
}

function formatDatetime(dt) {
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

(async () => {
  let db;
  try {
    db = await mysql.createConnection(MYSQL_CONFIG);
    console.log("✅ Connected to MySQL");

    const todayDate = dayjs().format('YYYY-MM-DD');
    console.log(`📆 Server started at: ${formatDatetime(new Date())}`);
    console.log(`🔍 Looking for active visitors with visit_date = ${todayDate}`);

    const [matchedVisitors] = await db.execute(`
      SELECT id, uuid, type, first_name, last_name, age, gender, group_name, group_size, group_type
      FROM visitors
      WHERE visit_date = ? AND active = TRUE
    `, [todayDate]);

    if (matchedVisitors.length > 0) {
      console.log(`🙋‍♀️ Found ${matchedVisitors.length} active visitor(s) for today:`);
      matchedVisitors.forEach(v => {
        if (v.type === 'individual') {
          console.log(`  👤 Individual - ID: ${v.id}, UUID: ${v.uuid}, Name: ${v.first_name} ${v.last_name}, Age: ${v.age}, Gender: ${v.gender}`);
        } else if (v.type === 'group') {
          console.log(`  👥 Group - ID: ${v.id}, UUID: ${v.uuid}, Name: ${v.group_name}, Size: ${v.group_size}, Type: ${v.group_type}, Age: ${v.age}, Gender: ${v.gender}`);
        }
      });
    } else {
      console.log("👻 No active visitors found for today.");
    }

  } catch (err) {
    console.error("❌ MySQL connection error:", err);
    process.exit(1);
  }

  const client = mqtt.connect(MQTT_SERVER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  client.on('connect', () => {
    console.log("✅ Connected to MQTT Broker");
    client.subscribe([MQTT_TOPIC, CONTROL_TOPIC], err => {
      if (err) console.error("❌ MQTT subscribe error:", err);
      else console.log(`🔔 Subscribed to topics: ${MQTT_TOPIC}, ${CONTROL_TOPIC}`);
    });
  });

  client.on('error', err => {
    console.error("❌ MQTT connection error:", err);
  });

  client.on('message', async (topic, message) => {
    try {
      const msgStr = message.toString();

      // ---------- Command ----------
      if (topic === CONTROL_TOPIC) {
        const command = JSON.parse(msgStr);
        if (command.uuid) {
          const matchedUuid = command.uuid.slice(-8);

          const [rows] = await db.execute(`
            SELECT id, type, first_name, last_name, group_name FROM visitors
            WHERE uuid = ?
            ORDER BY visit_date DESC, id DESC
            LIMIT 1
          `, [matchedUuid]);

          if (rows.length > 0) {
            const visitor = rows[0];
            const visitorId = visitor.id;
            const displayName = visitor.type === 'group' 
              ? `Group: ${visitor.group_name}` 
              : `Individual: ${visitor.first_name} ${visitor.last_name}`;

            if (command.action === 'deactivate_uuid') {
              await db.execute(`UPDATE visitors SET active = FALSE WHERE id = ?`, [visitorId]);
              console.log(`❎ UUID ${matchedUuid} (${displayName}) ถูกปิดใช้งาน`);
            }
            if (command.action === 'reactivate_uuid') {
              await db.execute(`UPDATE visitors SET active = TRUE WHERE id = ?`, [visitorId]);
              console.log(`✅ UUID ${matchedUuid} (${displayName}) ถูกเปิดใช้งานใหม่`);
            }
          } else {
            console.log(`⚠️ ไม่พบ visitor สำหรับ UUID: ${matchedUuid}`);
          }
        }
        return;
      }

      // ---------- Beacon ----------
      const payload = JSON.parse(msgStr);

      if (!(payload.uuid && payload.uuid.startsWith('74278bda'))) {
        console.log("⚠️ UUID ไม่ตรงเงื่อนไข, ข้าม");
        return;
      }

      const { timestamp, macAddress, rssi, HostName, uuid } = payload;

      // 1) บันทึกข้อมูลดิบ
      await db.execute(`
        INSERT INTO beacons (timestamp, mac_address, rssi, host_name, uuid)
        VALUES (?, ?, ?, ?, ?)
      `, [timestamp, macAddress, rssi, HostName, uuid]);
      console.log(`📥 [Raw] ${rssi} dBm @ ${timestamp}`);

      const matchedUuid = uuid.slice(-8);

      // ---------- ADDED: อัปเดต last_seen ใน ibeacons_tag เสมอเมื่อมีการเห็น beacon ----------
      const seenAt = dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'); // ADDED
      await db.execute(`
        UPDATE ibeacons_tag
        SET last_seen = ?
        WHERE uuid = ?
      `, [seenAt, matchedUuid]); // ADDED
      // -------------------------------------------------------------------------------

      // 2) หาคนล่าสุดที่ใช้ UUID นี้ และยัง active
      const [visitorRows] = await db.execute(`
        SELECT id, type, age, gender, first_name, last_name, group_name, group_size, group_type
        FROM visitors
        WHERE uuid = ? AND active = TRUE
        ORDER BY visit_date DESC, id DESC
        LIMIT 1
      `, [matchedUuid]);

      if (visitorRows.length > 0) {
        const visitor = visitorRows[0];
        const visitorId = visitor.id; // ✅ เก็บ visitor_id

        // ---------- ADDED: ถ้ามี visitor active ให้เซ็ต status เป็น in_use ----------
        await db.execute(`
          UPDATE ibeacons_tag
          SET status = 'in_use'
          WHERE uuid = ?
        `, [matchedUuid]);
        // --------------------------------------------------------------------------

        // ตรวจสอบซ้ำก่อน INSERT
        const [existingRows] = await db.execute(`
          SELECT 1 FROM beacon_visits
          WHERE timestamp = ? AND mac_address = ? AND uuid_full = ?
          LIMIT 1
        `, [timestamp, macAddress, uuid]);

        if (existingRows.length === 0) {
          // ✅ เพิ่ม visitor_id ในการ INSERT
          await db.execute(`
            INSERT INTO beacon_visits
              (timestamp, mac_address, rssi, host_name, uuid_full, matched_uuid, visitor_id, age, gender)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [timestamp, macAddress, rssi, HostName, uuid, matchedUuid, visitorId, visitor.age, visitor.gender]);
          
          if (visitor.type === 'individual') {
            console.log(`👤 [Visit-Individual] ID:${visitorId} ${visitor.first_name} ${visitor.last_name} → age=${visitor.age}, gender=${visitor.gender}`);
          } else if (visitor.type === 'group') {
            console.log(`👥 [Visit-Group] ID:${visitorId} ${visitor.group_name} (${visitor.group_type}, ${visitor.group_size} คน) → age=${visitor.age}, gender=${visitor.gender}`);
          }
        } else {
          console.log(`⚠️ [Visit] Duplicate entry skipped`);
        }
      } else {
        console.log("👻 No matching active visitor for UUID:", matchedUuid);
      }

      // 3) เก็บ buffer
      const key = `${HostName}|${uuid}`;
      if (!buffers[key]) buffers[key] = [];
      buffers[key].push({ timestamp, rssi });
      console.log(`🧮 Buffer[${key}]: ${buffers[key].length} entries`);

      // 4) คำนวณ avg RSSI
      while (buffers[key].length >= WINDOW_SIZE) {
        const windowData = buffers[key].slice(0, WINDOW_SIZE);
        const avgRssi = windowData.reduce((sum, x) => sum + x.rssi, 0) / WINDOW_SIZE;
        const windowStart = windowData[0].timestamp;
        const windowEnd   = windowData[WINDOW_SIZE - 1].timestamp;

        await db.execute(`
          INSERT INTO beacon_averages
            (window_start, window_end, avg_rssi, host_name, uuid)
          VALUES (?, ?, ?, ?, ?)
        `, [windowStart, windowEnd, avgRssi.toFixed(2), HostName, uuid]);

        console.log(`📝 [Avg] ${avgRssi.toFixed(2)} dBm (${windowStart} → ${windowEnd})`);
        buffers[key] = buffers[key].slice(STEP_SIZE);
      }

    } catch (err) {
      console.error("❌ Error processing MQTT message:", err);
    }
  });

})();
