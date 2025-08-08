const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

// CORS และ JSON middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL Configuration - เพิ่ม timeout settings
const MYSQL_CONFIG = {
    host: 'localhost',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'beacon_db',
    connectTimeout: 10000,      // 10 วินาที
    acquireTimeout: 10000,      // 10 วินาที
    timeout: 10000,             // 10 วินาที
};

// Mapping ระหว่าง hostname กับ room ID
const HOST_ROOM_MAPPING = {
    'ESP32_Host1': 1,
    'ESP32_Host2': 2,
    'ESP32_Host3': 3,
    'ESP32_Host4': 4,
    'ESP32_Host5': 5,
    'ESP32_Host6': 6,
    'ESP32_Host7': 7,
    'ESP32_Host8': 8
};

let db;

// ฟังก์ชันสำหรับสร้างชื่อที่แสดง
function createDisplayName(visitor) {
    if (visitor.type === 'group') {
        return visitor.group_name || `กลุ่ม ${visitor.uuid?.slice(-4) || 'Unknown'}`;
    } else if (visitor.type === 'individual') {
        if (visitor.first_name || visitor.last_name) {
            return `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim();
        } else {
            return `ผู้เยี่ยมชม ${visitor.uuid?.slice(-4) || 'Unknown'}`;
        }
    } else {
        return `ผู้เยี่ยมชม ${visitor.uuid?.slice(-4) || 'Unknown'}`;
    }
}

// ฟังก์ชันสำหรับสร้าง group/type ที่แสดง
function createDisplayGroup(visitor) {
    if (visitor.type === 'group') {
        return visitor.group_type || 'กลุ่มทั่วไป';
    } else {
        return 'บุคคลทั่วไป';
    }
}

// ฟังก์ชันสำหรับแปลงอายุให้แสดงผลสวย
function formatAge(age, type) {
    if (!age) return 'ไม่ระบุ';
    
    let ageStr = age.toString();

    // ลบคำว่า "ปี" ถ้ามีอยู่แล้ว
    ageStr = ageStr.replace(/ปี/g, '').trim();

    return `${ageStr} ปี`;
}

// ฟังก์ชันสำหรับแปลงเพศให้แสดงผลสวย (แก้ไขแล้ว)
function formatGender(gender, type) {
    if (!gender) return 'ไม่ระบุ';
    
    console.log(`🔍 Debug Gender: "${gender}", Type: "${type}"`); // เพิ่ม debug
    
    if (type === 'group') {
        // แปลง "M2F1O0" -> "ชาย 2 หญิง 1" (ไม่แสดงอื่นๆ เพราะเป็น 0)
        let parts = [];
        
        // หาจำนวนชาย
        const maleMatch = gender.match(/M(\d+)/);
        if (maleMatch) {
            const count = parseInt(maleMatch[1]);
            console.log(`👨 Male count: ${count}`);
            if (count > 0) {
                parts.push(`ชาย ${count}`);
            }
        }
        
        // หาจำนวนหญิง
        const femaleMatch = gender.match(/F(\d+)/);
        if (femaleMatch) {
            const count = parseInt(femaleMatch[1]);
            console.log(`👩 Female count: ${count}`);
            if (count > 0) {
                parts.push(`หญิง ${count}`);
            }
        }
        
        // หาจำนวนอื่นๆ
        const otherMatch = gender.match(/O(\d+)/);
        if (otherMatch) {
            const count = parseInt(otherMatch[1]);
            console.log(`🚻 Other count: ${count}`);
            if (count > 0) {
                parts.push(`อื่นๆ ${count}`);
            }
        }
        
        const result = parts.length > 0 ? parts.join(' ') : 'ไม่ระบุ';
        console.log(`✅ Final gender result: "${result}"`);
        return result;
    } else {
        // สำหรับบุคคล - แก้ไขส่วนนี้
        const genderMap = {
            'male': 'ชาย',
            'female': 'หญิง',
            'other': 'อื่นๆ',
            'M': 'ชาย',
            'F': 'หญิง',
            'O': 'อื่นๆ'
        };
        
        const result = genderMap[gender] || gender;
        console.log(`✅ Individual gender result: "${result}"`);
        return result;
    }
}

// ฟังก์ชันเชื่อมต่อ database แบบ async พร้อม timeout
async function initializeDatabase() {
    console.log('🔄 Attempting to connect to MySQL...');
    console.log(`📍 Config: ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
    
    try {
        // ใช้ Promise.race เพื่อกำหนด timeout
        const connectionPromise = mysql.createConnection(MYSQL_CONFIG);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 15000)
        );
        
        db = await Promise.race([connectionPromise, timeoutPromise]);
        
        // ทดสอบ query
        await db.execute('SELECT 1 as test');
        console.log('✅ MySQL connected successfully!');
        
        // ตรวจสอบโครงสร้างตาราง visitors
        try {
            const [columns] = await db.execute('SHOW COLUMNS FROM visitors');
            console.log('📋 Visitors table columns:');
            columns.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));
        } catch (err) {
            console.log('⚠️  Could not describe visitors table:', err.message);
        }
        
        return true;
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
        console.error('💡 Possible solutions:');
        console.error('   1. Make sure MAMP is running');
        console.error('   2. Check if MySQL port 8889 is open');
        console.error('   3. Verify database "beacon_db" exists');
        console.error('   4. Check username/password');
        
        // ให้ server ทำงานต่อไปแม้ DB ไม่เชื่อมต่อ
        return false;
    }
}

// ===========================
//  API ENDPOINTS
// ===========================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API Server is running',
        database_connected: !!db,
        timestamp: new Date()
    });
});

// ดึงข้อมูลผู้เยี่ยมชมปัจจุบัน (แก้ไขแล้ว)
app.get('/api/current-visitors', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            visitors: [],
            total: 0
        });
    }

    try {
        const todayDate = new Date().toISOString().split('T')[0]; // ได้ค่า '2025-08-08'
        console.log(`🔍 Executing improved query for current visitors on ${todayDate}`);

        // ปรับ Query ใหม่ให้ครบถ้วน
        const query = `
            SELECT
                v.id,
                v.uuid,
                v.type,
                v.first_name,
                v.last_name,
                v.group_name,
                v.group_size,
                v.group_type,
                v.age,
                v.gender,
                v.active,
                v.visit_date,
                v.created_at,
                it.tag_name,
                bv2.host_name as current_host,
                bv2.timestamp as last_seen,
                bv2.rssi as last_rssi
            FROM (
                -- เลือก visitor record ล่าสุดสำหรับแต่ละ UUID ที่ active = TRUE
                SELECT v1.*
                FROM visitors v1
                INNER JOIN (
                    SELECT uuid, MAX(id) as max_id
                    FROM visitors
                    WHERE DATE(visit_date) = ? AND active = TRUE
                    GROUP BY uuid
                ) v2 ON v1.uuid = v2.uuid AND v1.id = v2.max_id
            ) v
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            INNER JOIN (
                -- เลือก beacon signal ล่าสุดสำหรับแต่ละ UUID
                SELECT bv1.*
                FROM beacon_visits bv1
                INNER JOIN (
                    SELECT matched_uuid, MAX(timestamp) as max_timestamp
                    FROM beacon_visits
                    WHERE timestamp > NOW() - INTERVAL 2 MINUTE
                    GROUP BY matched_uuid
                ) bv2 ON bv1.matched_uuid = bv2.matched_uuid AND bv1.timestamp = bv2.max_timestamp
            ) bv2 ON v.uuid = bv2.matched_uuid
            ORDER BY bv2.timestamp DESC
        `;

        const [rows] = await db.execute(query, [todayDate]);
        
        console.log(`📊 Found ${rows.length} active visitors with recent signals`);
        
        // Debug: แสดงข้อมูลที่ได้
        rows.forEach((row, index) => {
            console.log(`${index + 1}. UUID: ${row.uuid}, Type: ${row.type}, Active: ${row.active}`);
            if (row.type === 'individual') {
                console.log(`   Name: ${row.first_name} ${row.last_name}`);
            } else {
                console.log(`   Group: ${row.group_name}`);
            }
            console.log(`   Host: ${row.current_host}, Last seen: ${row.last_seen}`);
        });

        const visitors = rows.map(row => {
            const displayName = createDisplayName(row);
            const displayGroup = createDisplayGroup(row);
            const formattedAge = formatAge(row.age, row.type);
            const formattedGender = formatGender(row.gender, row.type);

            return {
                id: row.id,
                uuid: row.uuid,
                name: displayName,
                tag: row.tag_name || `Tag${row.uuid.slice(-4).toUpperCase()}`,
                type: row.type,
                group: displayGroup,
                group_size: row.group_size,
                age: formattedAge,
                gender: formattedGender,
                current_host: row.current_host,
                current_room: HOST_ROOM_MAPPING[row.current_host] || null,
                last_seen: row.last_seen,
                last_rssi: row.last_rssi,
                active: row.active,
                visit_date: row.visit_date,
                created_at: row.created_at
            };
        });

        console.log(`📋 Final result: ${visitors.length} visitors ready for dashboard`);

        res.json({
            success: true,
            visitors: visitors,
            total: visitors.length,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching current visitors:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            visitors: [],
            total: 0
        });
    }
});

// เพิ่ม API สำหรับ debug ดู visitor records ทั้งหมดของ UUID นั้น
app.get('/api/debug-uuid/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        const uuid = req.params.uuid;
        
        // ดูข้อมูล visitors ทั้งหมดของ UUID นี้
        const [visitorRows] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name, group_type, 
                   age, gender, visit_date, active, created_at
            FROM visitors 
            WHERE uuid = ?
            ORDER BY visit_date DESC, id DESC
        `, [uuid]);

        // ดูข้อมูล beacon_visits ล่าสุดของ UUID นี้
        const [beaconRows] = await db.execute(`
            SELECT timestamp, host_name, rssi, age, gender
            FROM beacon_visits 
            WHERE matched_uuid = ?
            ORDER BY timestamp DESC
            LIMIT 10
        `, [uuid]);

        console.log(`🔍 Debug UUID ${uuid}:`);
        console.log(`📋 Visitor Records: ${visitorRows.length}`);
        visitorRows.forEach((v, i) => {
            console.log(`   ${i+1}. ID=${v.id}, Type=${v.type}, Active=${v.active}, Date=${v.visit_date}, Created=${v.created_at}`);
            if (v.type === 'individual') {
                console.log(`      Name: ${v.first_name} ${v.last_name}, Age: ${v.age}, Gender: ${v.gender}`);
            } else {
                console.log(`      Group: ${v.group_name}, Type: ${v.group_type}, Age: ${v.age}, Gender: ${v.gender}`);
            }
        });

        res.json({
            success: true,
            uuid: uuid,
            visitor_records: visitorRows,
            beacon_visits: beaconRows,
            total_visitor_records: visitorRows.length,
            total_beacon_visits: beaconRows.length
        });

    } catch (error) {
        console.error('❌ Error in debug UUID:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ดึงข้อมูลผู้เยี่ยมชมปัจจุบัน (Simple - ปรับปรุง Query)
app.get('/api/current-visitors-simple', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            visitors: [],
            total: 0
        });
    }

    try {
        const query = `
            SELECT 
                v.id, v.uuid, v.type, v.first_name, v.last_name, v.group_name, v.group_type, v.group_size, v.age, v.gender, v.active, v.created_at,
                it.tag_name,
                bv.host_name as current_host,
                MAX(bv.timestamp) as last_seen,
                bv.rssi as last_rssi
            FROM (
                -- เลือก record ล่าสุดสำหรับแต่ละ UUID ที่ active = 1
                SELECT v1.*
                FROM visitors v1
                INNER JOIN (
                    SELECT uuid, MAX(id) as max_id
                    FROM visitors
                    WHERE visit_date = CURDATE() AND active = TRUE
                    GROUP BY uuid
                ) v2 ON v1.uuid = v2.uuid AND v1.id = v2.max_id
            ) v
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            LEFT JOIN beacon_visits bv ON v.uuid = bv.matched_uuid
            WHERE bv.timestamp > NOW() - INTERVAL 1 MINUTE
            GROUP BY v.uuid
            ORDER BY last_seen DESC
        `;

        console.log('🔍 Executing improved current-visitors-simple query...');
        const [rows] = await db.execute(query);
        
        console.log(`📊 Found ${rows.length} active visitors (simple query)`);
        
        const visitors = rows.map(row => {
            const displayName = createDisplayName(row);
            const displayGroup = createDisplayGroup(row);
            const formattedAge = formatAge(row.age, row.type);
            const formattedGender = formatGender(row.gender, row.type);
            
            return {
                id: row.id,
                uuid: row.uuid,
                name: displayName,
                tag: row.tag_name || `Tag${row.uuid.slice(-4).toUpperCase()}`,
                type: row.type,
                group: displayGroup,
                group_size: row.group_size,
                age: formattedAge,
                gender: formattedGender,
                current_host: row.current_host,
                current_room: HOST_ROOM_MAPPING[row.current_host] || null,
                last_seen: row.last_seen,
                last_rssi: row.last_rssi,
                active: row.active,
                created_at: row.created_at
            };
        });

        res.json({
            success: true,
            visitors: visitors,
            total: visitors.length,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching current visitors:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            visitors: [],
            total: 0
        });
    }
});

// เพิ่ม endpoint ใหม่นี้ต่อจากโค้ด API เดิม (หลัง endpoint อื่นๆ)

// API สำหรับตรวจสอบข้อมูลใน database - เพิ่มใหม่
app.get('/api/debug-database', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        // ดูข้อมูล visitors ที่ active
        const [activeVisitors] = await db.execute(`
            SELECT uuid, id, type, first_name, last_name, group_name, 
                   visit_date, active, created_at
            FROM visitors 
            WHERE active = TRUE
            ORDER BY uuid, visit_date DESC, id DESC
        `);

        // ดู beacon visits ล่าสุด 2 นาที
        const [recentBeacons] = await db.execute(`
            SELECT matched_uuid, host_name, timestamp, rssi
            FROM beacon_visits 
            WHERE timestamp > NOW() - INTERVAL 2 MINUTE
            ORDER BY timestamp DESC
            LIMIT 20
        `);

        // นับจำนวน records ต่อ UUID
        const [uuidCounts] = await db.execute(`
            SELECT uuid, COUNT(*) as count, 
                   SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_count
            FROM visitors 
            GROUP BY uuid
            HAVING COUNT(*) > 1 OR active_count > 1
            ORDER BY count DESC
        `);

        // ดูข้อมูลเฉพาะ UUID ที่มีปัญหา
        const [fd3cRecords] = await db.execute(`
            SELECT id, type, first_name, last_name, group_name, active, 
                   visit_date, created_at
            FROM visitors 
            WHERE uuid = 'FD3C82A6'
            ORDER BY id DESC
        `);

        console.log('🔍 Database Debug Info:');
        console.log(`📊 Active visitors: ${activeVisitors.length}`);
        console.log(`📡 Recent beacon visits: ${recentBeacons.length}`);
        console.log(`⚠️  UUIDs with multiple records: ${uuidCounts.length}`);
        console.log(`🔎 FD3C82A6 records: ${fd3cRecords.length}`);

        // แสดง FD3C82A6 records ใน console
        fd3cRecords.forEach((record, index) => {
            console.log(`   ${index + 1}. ID=${record.id}, Active=${record.active}, Type=${record.type}`);
            if (record.type === 'individual') {
                console.log(`      Name: ${record.first_name} ${record.last_name}`);
            } else {
                console.log(`      Group: ${record.group_name}`);
            }
        });

        res.json({
            success: true,
            active_visitors: activeVisitors,
            recent_beacon_visits: recentBeacons,
            uuid_counts: uuidCounts,
            fd3c_records: fd3cRecords,
            summary: {
                active_visitors_count: activeVisitors.length,
                recent_beacons_count: recentBeacons.length,
                problematic_uuids: uuidCounts.length,
                fd3c_records_count: fd3cRecords.length
            }
        });

    } catch (error) {
        console.error('❌ Error in debug database:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// API สำหรับดู visitor records ของ UUID เฉพาะ - เพิ่มใหม่
app.get('/api/debug-uuid/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        const uuid = req.params.uuid.toUpperCase();
        
        // ดูข้อมูล visitors ทั้งหมดของ UUID นี้
        const [visitorRows] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name, group_type, 
                   age, gender, visit_date, active, created_at
            FROM visitors 
            WHERE uuid = ?
            ORDER BY visit_date DESC, id DESC
        `, [uuid]);

        // ดูข้อมูล beacon_visits ล่าสุดของ UUID นี้
        const [beaconRows] = await db.execute(`
            SELECT timestamp, host_name, rssi, age, gender
            FROM beacon_visits 
            WHERE matched_uuid = ?
            ORDER BY timestamp DESC
            LIMIT 10
        `, [uuid]);

        // ทดสอบ query แบบ MQTT processor
        const [mqttQuery] = await db.execute(`
            SELECT id, type, age, gender, first_name, last_name, group_name, group_size, group_type
            FROM visitors
            WHERE uuid = ? AND active = TRUE
            ORDER BY visit_date DESC, id DESC
            LIMIT 1
        `, [uuid]);

        console.log(`🔍 Debug UUID ${uuid}:`);
        console.log(`📋 Visitor Records: ${visitorRows.length}`);
        console.log(`🎯 MQTT Query Result: ${mqttQuery.length}`);
        
        if (mqttQuery.length > 0) {
            const v = mqttQuery[0];
            console.log(`   Selected: ID=${v.id}, Type=${v.type}, Active=TRUE`);
            if (v.type === 'individual') {
                console.log(`   Individual: ${v.first_name} ${v.last_name}`);
            } else {
                console.log(`   Group: ${v.group_name}`);
            }
        }

        visitorRows.forEach((v, i) => {
            console.log(`   ${i+1}. ID=${v.id}, Type=${v.type}, Active=${v.active}, Date=${v.visit_date}`);
        });

        res.json({
            success: true,
            uuid: uuid,
            visitor_records: visitorRows,
            beacon_visits: beaconRows,
            mqtt_query_result: mqttQuery,
            total_visitor_records: visitorRows.length,
            total_beacon_visits: beaconRows.length
        });

    } catch (error) {
        console.error('❌ Error in debug UUID:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ดึงข้อมูล beacon ล่าสุด (แก้ไขแล้ว)
app.get('/api/latest-beacon-data', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            data: []
        });
    }

    try {
        const sinceParam = req.query.since || '1 MINUTE';
        
        const query = `
            SELECT 
                bv.timestamp,
                bv.host_name as hostName,
                bv.uuid_full as uuid,
                bv.matched_uuid,
                bv.rssi,
                bv.age as beacon_age,
                bv.gender as beacon_gender,
                v.uuid as visitor_uuid,
                v.type,
                v.first_name,
                v.last_name,
                v.group_name,
                v.group_type,
                v.group_size,
                v.age as visitor_age,
                v.gender as visitor_gender,
                it.tag_name
            FROM beacon_visits bv
            LEFT JOIN visitors v ON bv.matched_uuid = v.uuid
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            WHERE bv.timestamp > NOW() - INTERVAL ${sinceParam}
            ORDER BY bv.timestamp DESC
            LIMIT 100
        `;

        console.log('🔍 Query:', query); // Debug query

        const [rows] = await db.execute(query);
        
        console.log('📊 Raw data sample:', rows.slice(0, 2)); // Debug raw data
        
        // เพิ่มข้อมูล name และ tag ให้แต่ละ record
        const enrichedRows = rows.map(row => {
            const displayName = createDisplayName({
                type: row.type,
                first_name: row.first_name,
                last_name: row.last_name,
                group_name: row.group_name,
                uuid: row.matched_uuid
            });

            const displayGroup = createDisplayGroup({
                type: row.type,
                group_type: row.group_type
            });

            // ใช้ข้อมูลจาก visitors table แทน beacon_visits
            const formattedAge = formatAge(row.visitor_age || row.beacon_age, row.type);
            const formattedGender = formatGender(row.visitor_gender || row.beacon_gender, row.type);

            console.log(`🏷️  UUID: ${row.matched_uuid}, Type: ${row.type}, Name: ${displayName}, Age: ${formattedAge}, Gender: ${formattedGender}`);

            return {
                ...row,
                name: displayName,
                tag: row.tag_name || `Tag${row.matched_uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
                group: displayGroup,
                age: formattedAge,
                gender: formattedGender,
                group_size: row.group_size,
                room_id: HOST_ROOM_MAPPING[row.hostName] || null
            };
        });
        
        res.json({
            success: true,
            data: enrichedRows,
            count: enrichedRows.length,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching latest beacon data:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            data: []
        });
    }
});

app.get('/api/realtime-events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write('data: {"message": "Connected to real-time stream", "connected": true}\n\n');

    if (!db) {
        res.write('data: {"error": "Database not available"}\n\n');
        return;
    }

    let lastTimestamp = new Date();
    
    const interval = setInterval(async () => {
        try {
            const todayDate = new Date().toISOString().split('T')[0];
            
            // Query ที่ถูกปรับปรุงให้มีประสิทธิภาพและถูกต้องที่สุด
            // 1. เลือก Beacon events ที่เกิดขึ้นใหม่ (timestamp > lastTimestamp)
            // 2. INNER JOIN กับ subquery ที่ดึงเฉพาะ visitor record ล่าสุด (max id) และ active = TRUE
            const query = `
                SELECT
                    v.uuid,
                    MAX(v.id) AS visitor_id,
                    MAX(v.type) AS visitor_type,
                    MAX(v.first_name) AS visitor_first_name,
                    MAX(v.last_name) AS visitor_last_name,
                    MAX(v.group_name) AS visitor_group_name,
                    MAX(v.group_size) AS visitor_group_size,
                    MAX(v.group_type) AS visitor_group_type,
                    MAX(v.age) AS visitor_age,
                    MAX(v.gender) AS visitor_gender,
                    MAX(it.tag_name) AS tag_name,
                    MAX(bv.host_name) AS host_name,
                    MAX(bv.timestamp) AS last_seen,
                    MAX(bv.rssi) AS last_rssi
                FROM visitors v
                INNER JOIN beacon_visits bv ON v.uuid = bv.matched_uuid
                LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
                WHERE v.active = TRUE AND v.visit_date = ? AND bv.timestamp > ?
                GROUP BY v.uuid
                ORDER BY MAX(bv.timestamp) DESC
            `;
            
            const [rows] = await db.execute(query, [todayDate, lastTimestamp]);
            
            if (rows.length > 0) {
                lastTimestamp = new Date(rows[rows.length - 1].timestamp);

rows.forEach(row => {
    const displayName = createDisplayName({
        type: row.visitor_type, // แก้ไข
        first_name: row.visitor_first_name, // แก้ไข
        last_name: row.visitor_last_name, // แก้ไข
        group_name: row.visitor_group_name, // แก้ไข
        uuid: row.uuid
    });

    const displayGroup = createDisplayGroup({
        type: row.visitor_type, // แก้ไข
        group_type: row.visitor_group_type // แก้ไข
    });

    const formattedAge = formatAge(row.visitor_age, row.visitor_type); // แก้ไข
    const formattedGender = formatGender(row.visitor_gender, row.visitor_type); // แก้ไข

    const eventData = {
        timestamp: row.last_seen, // แก้ไข: ใช้ last_seen จาก Query
        hostName: row.host_name, // แก้ไข: ใช้ host_name จาก Query
        matched_uuid: row.uuid,
        rssi: row.last_rssi, // แก้ไข: ใช้ last_rssi
        age: formattedAge,
        gender: formattedGender,
        name: displayName,
        tag: row.tag_name || `Tag${row.uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
        group: displayGroup,
        group_size: row.visitor_group_size, // แก้ไข
        room_id: HOST_ROOM_MAPPING[row.host_name] || null, // แก้ไข: ใช้ host_name
        type: row.visitor_type, // แก้ไข
        visitor_id: row.visitor_id, // แก้ไข
        active: row.active // ใน Query ใหม่ไม่มี active
    };
                    
                    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
                });
            }
        } catch (error) {
            console.error('❌ SSE error:', error);
            res.write(`data: {"error": "Database query failed", "details": "${error.message}"}\n\n`);
        }
    }, 3000);

    req.on('close', () => {
        clearInterval(interval);
        console.log('📡 SSE client disconnected');
    });
});

app.get('/api/debug-today-visitors', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        const todayDate = new Date().toISOString().split('T')[0];
        
        // ดู visitors ทั้งหมดวันนี้
        const [allToday] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name, 
                   active, visit_date, created_at
            FROM visitors
            WHERE visit_date = ?
            ORDER BY id DESC
        `, [todayDate]);

        // ดู active visitors วันนี้
        const [activeToday] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name,
                   active, visit_date, created_at
            FROM visitors
            WHERE visit_date = ? AND active = TRUE
            ORDER BY id DESC
        `, [todayDate]);

        console.log(`📅 Debug for date: ${todayDate}`);
        console.log(`📊 Total visitors today: ${allToday.length}`);
        console.log(`✅ Active visitors today: ${activeToday.length}`);

        activeToday.forEach((v, index) => {
            console.log(`  ${index + 1}. ID=${v.id}, UUID=${v.uuid}, Active=${v.active}, Type=${v.type}`);
            if (v.type === 'individual') {
                console.log(`     Name: ${v.first_name} ${v.last_name}`);
            } else {
                console.log(`     Group: ${v.group_name}`);
            }
        });

        res.json({
            success: true,
            date: todayDate,
            all_visitors_today: allToday,
            active_visitors_today: activeToday,
            summary: {
                total_today: allToday.length,
                active_today: activeToday.length
            }
        });

    } catch (error) {
        console.error('❌ Error in debug today visitors:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ===========================
//  START SERVER
// ===========================

const PORT = process.env.PORT || 4000;

async function startServer() {
    console.log('🚀 Starting API Server...');
    
    // พยายามเชื่อมต่อ database (ไม่บล็อค server)
    await initializeDatabase();
    
    // เริ่ม server ไม่ว่า database จะเชื่อมต่อได้หรือไม่
    app.listen(PORT, () => {
        console.log(`🌟 API Server running on port ${PORT}`);
        console.log(`📊 Dashboard available at http://localhost:${PORT}`);
        console.log(`📡 Real-time stream: http://localhost:${PORT}/api/realtime-events`);
        console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
        
        if (!db) {
            console.log('⚠️  Server started without database connection');
            console.log('💡 Check MAMP/MySQL and restart server');
        }
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down server...');
    if (db) {
        await db.end();
        console.log('✅ Database connection closed');
    }
    process.exit(0);
});

// เริ่มต้น server
startServer();