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

// ฟังก์ชันสำหรับแปลงเพศให้แสดงผลสวย
function formatGender(gender, type) {
    if (!gender) return 'ไม่ระบุ';
    
    console.log(`🔍 Debug Gender: "${gender}", Type: "${type}"`);
    
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
        // สำหรับบุคคล
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

// ดึงข้อมูลผู้เยี่ยมชมปัจจุบัน (ปรับปรุงให้ส่ง group_size และ type)
app.get('/api/group-members/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            members: []
        });
    }

    try {
        const uuid = req.params.uuid;
        
        // ดูข้อมูลกลุ่มหลักจากตาราง visitors
        const [groupInfo] = await db.execute(`
            SELECT id, type, group_name, group_size, group_type, gender, age
            FROM visitors
            WHERE uuid = ? AND active = TRUE AND type = 'group'
            ORDER BY id DESC
            LIMIT 1
        `, [uuid]);

        if (groupInfo.length === 0) {
            return res.json({
                success: false,
                error: 'Group not found or not active',
                members: []
            });
        }

        const group = groupInfo[0];
        console.log(`👥 Looking for members of group ID: ${group.id}, UUID: ${uuid}, Name: ${group.group_name}`);
        
        // ดึงสมาชิกกลุ่มจากตาราง group_members
        const [members] = await db.execute(`
            SELECT gm.id, gm.first_name, gm.last_name, gm.age, gm.gender, gm.created_at
            FROM group_members gm
            WHERE gm.group_visitor_id = ?
            ORDER BY gm.id ASC
        `, [group.id]);

        console.log(`📋 Found ${members.length} members in database for group ${group.id}`);

        if (members.length === 0) {
            console.log(`⚠️ No members found in group_members table for group_visitor_id: ${group.id}`);
            
            // ตรวจสอบว่ามีข้อมูลใน group_members table หรือไม่
            const [allGroupMembers] = await db.execute(`
                SELECT gm.group_visitor_id, COUNT(*) as member_count, v.group_name
                FROM group_members gm
                LEFT JOIN visitors v ON gm.group_visitor_id = v.id
                GROUP BY gm.group_visitor_id
                ORDER BY gm.group_visitor_id DESC
                LIMIT 10
            `);
            
            console.log('📊 Available groups in group_members table:', allGroupMembers);
            
            return res.json({
                success: false,
                error: 'No members found in database',
                members: [],
                debug: {
                    group_visitor_id: group.id,
                    available_groups: allGroupMembers
                }
            });
        }

        // แปลงข้อมูลสมาชิกให้เป็นรูปแบบที่ต้องการ
        const formattedMembers = members.map((member, index) => {
            const genderMap = {
                'male': 'ชาย',
                'female': 'หญิง',
                'other': 'อื่นๆ'
            };

            const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
            
            return {
                id: member.id,
                name: fullName || `สมาชิกคนที่ ${index + 1}`,
                first_name: member.first_name,
                last_name: member.last_name,
                gender: genderMap[member.gender] || member.gender || 'ไม่ระบุ',
                age: member.age ? `${member.age} ปี` : 'ไม่ระบุ',
                type: 'group_member',
                created_at: member.created_at
            };
        });

        console.log(`✅ Successfully formatted ${formattedMembers.length} group members`);
        formattedMembers.forEach((member, i) => {
            console.log(`   ${i+1}. ${member.name} (${member.gender}, ${member.age})`);
        });

        res.json({
            success: true,
            group_uuid: uuid,
            group_info: {
                id: group.id,
                name: group.group_name,
                size: group.group_size,
                type: group.group_type,
                age: group.age,
                gender: formatGender(group.gender, 'group')
            },
            members: formattedMembers,
            total_members: formattedMembers.length
        });

    } catch (error) {
        console.error('❌ Error fetching group members:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            details: error.message,
            members: []
        });
    }
});

// เพิ่ม API debug สำหรับดูข้อมูลใน group_members table
app.get('/api/debug-group-members', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        // ดูข้อมูลทั้งหมดใน group_members table
        const [allMembers] = await db.execute(`
            SELECT gm.*, v.uuid, v.group_name, v.type, v.active
            FROM group_members gm
            LEFT JOIN visitors v ON gm.group_visitor_id = v.id
            ORDER BY gm.group_visitor_id DESC, gm.id ASC
            LIMIT 50
        `);

        // นับจำนวนสมาชิกต่อกลุ่ม
        const [groupCounts] = await db.execute(`
            SELECT gm.group_visitor_id, COUNT(*) as member_count, 
                   MAX(v.uuid) as group_uuid, MAX(v.group_name) as group_name, 
                   MAX(v.active) as active
            FROM group_members gm
            LEFT JOIN visitors v ON gm.group_visitor_id = v.id
            GROUP BY gm.group_visitor_id
            ORDER BY member_count DESC
        `);

        console.log('🔍 Group Members Debug Info:');
        console.log(`📊 Total member records: ${allMembers.length}`);
        console.log(`👥 Number of groups: ${groupCounts.length}`);
        
        groupCounts.forEach(group => {
            console.log(`   Group ID: ${group.group_visitor_id}, UUID: ${group.group_uuid}, Name: ${group.group_name}, Members: ${group.member_count}, Active: ${group.active}`);
        });

        res.json({
            success: true,
            all_members: allMembers,
            group_counts: groupCounts,
            summary: {
                total_member_records: allMembers.length,
                total_groups: groupCounts.length
            }
        });

    } catch (error) {
        console.error('❌ Error in debug group members:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ปรับปรุง API current-visitors ให้มี timeout ที่เหมาะสมกว่า
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
        const todayDate = new Date().toISOString().split('T')[0];
        console.log(`🔍 Executing current visitors query for ${todayDate}`);

        // ปรับ timeout ให้เหมาะสมกว่า - ใช้ 2 นาทีแทน 2 นาที
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
                -- เพิ่ม timeout เป็น 3 นาที
                SELECT bv1.*
                FROM beacon_visits bv1
                INNER JOIN (
                    SELECT matched_uuid, MAX(timestamp) as max_timestamp
                    FROM beacon_visits
                    WHERE timestamp > NOW() - INTERVAL 3 MINUTE
                    GROUP BY matched_uuid
                ) bv2 ON bv1.matched_uuid = bv2.matched_uuid AND bv1.timestamp = bv2.max_timestamp
            ) bv2 ON v.uuid = bv2.matched_uuid
            ORDER BY bv2.timestamp DESC
        `;

        const [rows] = await db.execute(query, [todayDate]);
        
        console.log(`📊 Found ${rows.length} active visitors with recent signals (within 3 minutes)`);
        
        // Debug: แสดงข้อมูลที่ได้
        rows.forEach((row, index) => {
            const timeSinceLastSeen = new Date() - new Date(row.last_seen);
            console.log(`${index + 1}. UUID: ${row.uuid}, Type: ${row.type}, Group Size: ${row.group_size}, Last seen: ${Math.round(timeSinceLastSeen/1000)}s ago`);
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
                group_size: row.group_size || 1,
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

// เพิ่ม API ใหม่สำหรับดูสมาชิกกลุ่ม
app.get('/api/group-members/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            members: []
        });
    }

    try {
        const uuid = req.params.uuid;
        
        // ดูข้อมูลกลุ่มหลัก
        const [groupInfo] = await db.execute(`
            SELECT type, group_name, group_size, group_type, gender, age
            FROM visitors
            WHERE uuid = ? AND active = TRUE AND type = 'group'
            ORDER BY id DESC
            LIMIT 1
        `, [uuid]);

        if (groupInfo.length === 0) {
            return res.json({
                success: false,
                error: 'Group not found or not active',
                members: []
            });
        }

        const group = groupInfo[0];
        
        // สร้างข้อมูลสมาชิกจำลอง (เนื่องจากไม่มีตารางสมาชิกแยก)
        const members = [];
        const groupSize = group.group_size || 1;
        
        // แยกข้อมูลเพศจาก format "M2F1O0"
        const genderInfo = {
            male: 0,
            female: 0,
            other: 0
        };
        
        if (group.gender) {
            const maleMatch = group.gender.match(/M(\d+)/);
            const femaleMatch = group.gender.match(/F(\d+)/);
            const otherMatch = group.gender.match(/O(\d+)/);
            
            if (maleMatch) genderInfo.male = parseInt(maleMatch[1]);
            if (femaleMatch) genderInfo.female = parseInt(femaleMatch[1]);
            if (otherMatch) genderInfo.other = parseInt(otherMatch[1]);
        }

        // สร้างสมาชิกตามจำนวนและเพศ
        let memberIndex = 1;
        
        // เพิ่มสมาชิกชาย
        for (let i = 0; i < genderInfo.male; i++) {
            members.push({
                id: memberIndex,
                name: `สมาชิกคนที่ ${memberIndex}`,
                gender: 'ชาย',
                age: group.age || 'ไม่ระบุ',
                type: 'group_member'
            });
            memberIndex++;
        }
        
        // เพิ่มสมาชิกหญิง
        for (let i = 0; i < genderInfo.female; i++) {
            members.push({
                id: memberIndex,
                name: `สมาชิกคนที่ ${memberIndex}`,
                gender: 'หญิง',
                age: group.age || 'ไม่ระบุ',
                type: 'group_member'
            });
            memberIndex++;
        }
        
        // เพิ่มสมาชิกอื่นๆ
        for (let i = 0; i < genderInfo.other; i++) {
            members.push({
                id: memberIndex,
                name: `สมาชิกคนที่ ${memberIndex}`,
                gender: 'อื่นๆ',
                age: group.age || 'ไม่ระบุ',
                type: 'group_member'
            });
            memberIndex++;
        }
        
        // ถ้ายังไม่ครบตาม group_size ให้เพิ่มสมาชิกทั่วไป
        while (members.length < groupSize) {
            members.push({
                id: memberIndex,
                name: `สมาชิกคนที่ ${memberIndex}`,
                gender: 'ไม่ระบุ',
                age: group.age || 'ไม่ระบุ',
                type: 'group_member'
            });
            memberIndex++;
        }

        console.log(`👥 Group ${uuid}: ${group.group_name} has ${members.length} members`);

        res.json({
            success: true,
            group_uuid: uuid,
            group_info: {
                name: group.group_name,
                size: group.group_size,
                type: group.group_type,
                age: group.age,
                gender: formatGender(group.gender, 'group')
            },
            members: members,
            total_members: members.length
        });

    } catch (error) {
        console.error('❌ Error fetching group members:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            members: []
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
                   group_size, age, gender, visit_date, active, created_at
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
            console.log(`   ${i+1}. ID=${v.id}, Type=${v.type}, Active=${v.active}, Date=${v.visit_date}, Group Size=${v.group_size}, Created=${v.created_at}`);
            if (v.type === 'individual') {
                console.log(`      Name: ${v.first_name} ${v.last_name}, Age: ${v.age}, Gender: ${v.gender}`);
            } else {
                console.log(`      Group: ${v.group_name}, Type: ${v.group_type}, Size: ${v.group_size}, Age: ${v.age}, Gender: ${v.gender}`);
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
                group_size: row.group_size || 1, // เพิ่ม group_size
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

// API สำหรับตรวจสอบข้อมูลใน database - เพิ่มใหม่
app.get('/api/debug-database', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        // ดูข้อมูล visitors ที่ active
        const [activeVisitors] = await db.execute(`
            SELECT uuid, id, type, first_name, last_name, group_name, group_size,
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
                   SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_count,
                   SUM(CASE WHEN type = 'group' THEN COALESCE(group_size, 1) ELSE 1 END) as total_people
            FROM visitors 
            GROUP BY uuid
            HAVING COUNT(*) > 1 OR active_count > 1
            ORDER BY count DESC
        `);

        console.log('🔍 Database Debug Info:');
        console.log(`📊 Active visitors: ${activeVisitors.length}`);
        console.log(`📡 Recent beacon visits: ${recentBeacons.length}`);
        console.log(`⚠️  UUIDs with multiple records: ${uuidCounts.length}`);

        res.json({
            success: true,
            active_visitors: activeVisitors,
            recent_beacon_visits: recentBeacons,
            uuid_counts: uuidCounts,
            summary: {
                active_visitors_count: activeVisitors.length,
                recent_beacons_count: recentBeacons.length,
                problematic_uuids: uuidCounts.length
            }
        });

    } catch (error) {
        console.error('❌ Error in debug database:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ดึงข้อมูล beacon ล่าสุด (ปรับปรุงให้ส่ง group_size และ type)
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

        console.log('🔍 Query:', query);

        const [rows] = await db.execute(query);
        
        console.log('📊 Raw data sample:', rows.slice(0, 2));
        
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

            console.log(`🏷️  UUID: ${row.matched_uuid}, Type: ${row.type}, Name: ${displayName}, Group Size: ${row.group_size}, Age: ${formattedAge}, Gender: ${formattedGender}`);

            return {
                ...row,
                name: displayName,
                tag: row.tag_name || `Tag${row.matched_uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
                group: displayGroup,
                type: row.type || 'individual', // เพิ่ม type
                group_size: row.group_size || 1, // เพิ่ม group_size
                age: formattedAge,
                gender: formattedGender,
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

// Server-Sent Events สำหรับ real-time (ปรับปรุงให้ส่ง group_size และ type)
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
            // รวม group_size และ type ด้วย
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
                lastTimestamp = new Date(Math.max(...rows.map(r => new Date(r.last_seen))));

                rows.forEach(row => {
                    const displayName = createDisplayName({
                        type: row.visitor_type,
                        first_name: row.visitor_first_name,
                        last_name: row.visitor_last_name,
                        group_name: row.visitor_group_name,
                        uuid: row.uuid
                    });

                    const displayGroup = createDisplayGroup({
                        type: row.visitor_type,
                        group_type: row.visitor_group_type
                    });

                    const formattedAge = formatAge(row.visitor_age, row.visitor_type);
                    const formattedGender = formatGender(row.visitor_gender, row.visitor_type);

                    const eventData = {
                        timestamp: row.last_seen,
                        hostName: row.host_name,
                        uuid: row.uuid, // ใช้ uuid แทน matched_uuid
                        matched_uuid: row.uuid,
                        rssi: row.last_rssi,
                        age: formattedAge,
                        gender: formattedGender,
                        name: displayName,
                        tag: row.tag_name || `Tag${row.uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
                        group: displayGroup,
                        type: row.visitor_type || 'individual', // เพิ่ม type
                        group_size: row.visitor_group_size || 1, // เพิ่ม group_size
                        room_id: HOST_ROOM_MAPPING[row.host_name] || null,
                        visitor_id: row.visitor_id
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

// Debug API สำหรับ visitors วันนี้
app.get('/api/debug-today-visitors', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }

    try {
        const todayDate = new Date().toISOString().split('T')[0];
        
        // ดู visitors ทั้งหมดวันนี้
        const [allToday] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name, group_size,
                   active, visit_date, created_at
            FROM visitors
            WHERE visit_date = ?
            ORDER BY id DESC
        `, [todayDate]);

        // ดู active visitors วันนี้
        const [activeToday] = await db.execute(`
            SELECT id, uuid, type, first_name, last_name, group_name, group_size,
                   active, visit_date, created_at
            FROM visitors
            WHERE visit_date = ? AND active = TRUE
            ORDER BY id DESC
        `, [todayDate]);

        console.log(`📅 Debug for date: ${todayDate}`);
        console.log(`📊 Total visitors today: ${allToday.length}`);
        console.log(`✅ Active visitors today: ${activeToday.length}`);

        activeToday.forEach((v, index) => {
            console.log(`  ${index + 1}. ID=${v.id}, UUID=${v.uuid}, Active=${v.active}, Type=${v.type}, Group Size=${v.group_size}`);
            if (v.type === 'individual') {
                console.log(`     Name: ${v.first_name} ${v.last_name}`);
            } else {
                console.log(`     Group: ${v.group_name} (${v.group_size} คน)`);
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

app.get('/api/active-beacons', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            count: 0
        });
    }

    try {
        // นับจำนวน tag ที่มีสถานะ 'in_use'
        const [rows] = await db.execute(`
            SELECT COUNT(*) as active_count 
            FROM ibeacons_tag 
            WHERE status = 'in_use'
        `);

        const activeCount = rows[0]?.active_count || 0;
        
        console.log(`📡 Active beacons count: ${activeCount}`);

        res.json({
            success: true,
            count: activeCount,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching active beacons:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            count: 0
        });
    }
});

// ปรับปรุง API search-visitors ให้แสดงเฉพาะผู้เยี่ยมชมที่ active
app.get('/api/search-visitors', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            visitors: []
        });
    }

    try {
        const { name, tag, room, type } = req.query;
        console.log('🔍 Search parameters:', { name, tag, room, type });

        // ส่วนที่ 1: ค้นหาจากตาราง visitors (เฉพาะที่ active)
        let visitorQuery = `
            SELECT DISTINCT
                v.id, v.uuid, v.type, v.first_name, v.last_name, 
                v.group_name, v.group_type, v.group_size, 
                v.age, v.gender, v.active, v.visit_date, v.created_at,
                it.tag_name,
                cv.current_host, cv.current_room, cv.last_seen, cv.last_rssi,
                'visitor' as source_type
            FROM visitors v
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            LEFT JOIN (
                SELECT 
                    matched_uuid,
                    host_name as current_host,
                    CASE 
                        WHEN host_name = 'ESP32_Host1' THEN 1
                        WHEN host_name = 'ESP32_Host2' THEN 2
                        WHEN host_name = 'ESP32_Host3' THEN 3
                        WHEN host_name = 'ESP32_Host4' THEN 4
                        WHEN host_name = 'ESP32_Host5' THEN 5
                        WHEN host_name = 'ESP32_Host6' THEN 6
                        WHEN host_name = 'ESP32_Host7' THEN 7
                        WHEN host_name = 'ESP32_Host8' THEN 8
                        ELSE NULL
                    END as current_room,
                    timestamp as last_seen,
                    rssi as last_rssi
                FROM beacon_visits bv1
                WHERE bv1.timestamp = (
                    SELECT MAX(bv2.timestamp)
                    FROM beacon_visits bv2
                    WHERE bv2.matched_uuid = bv1.matched_uuid
                )
                -- ✨ เพิ่มเงื่อนไขให้แสดงเฉพาะที่เห็นภายใน 2 นาที
                AND bv1.timestamp > NOW() - INTERVAL 2 MINUTE
            ) cv ON v.uuid = cv.matched_uuid
            WHERE v.id = (
                SELECT MAX(v2.id) 
                FROM visitors v2 
                WHERE v2.uuid = v.uuid 
                AND v2.visit_date >= CURDATE()
            )
            -- ✨ เพิ่มเงื่อนไขให้แสดงเฉพาะที่ active และมี current_room
            AND v.active = TRUE
            AND cv.current_room IS NOT NULL
        `;

        // ส่วนที่ 2: ค้นหาจากตาราง group_members (เฉพาะที่ active)
        let memberQuery = `
            SELECT DISTINCT
                NULL as id, NULL as uuid, 'individual' as type, 
                gm.first_name, gm.last_name, 
                CONCAT('สมาชิกของ ', v.group_name) as group_name, 
                'สมาชิกกลุ่ม' as group_type, 1 as group_size,
                gm.age, gm.gender, 1 as active, 
                v.visit_date, gm.created_at,
                CONCAT('Tag', SUBSTRING(v.uuid, -4)) as tag_name,
                cv.current_host, cv.current_room, cv.last_seen, cv.last_rssi,
                'member' as source_type
            FROM group_members gm
            JOIN visitors v ON gm.group_visitor_id = v.id
            LEFT JOIN (
                SELECT 
                    matched_uuid,
                    host_name as current_host,
                    CASE 
                        WHEN host_name = 'ESP32_Host1' THEN 1
                        WHEN host_name = 'ESP32_Host2' THEN 2
                        WHEN host_name = 'ESP32_Host3' THEN 3
                        WHEN host_name = 'ESP32_Host4' THEN 4
                        WHEN host_name = 'ESP32_Host5' THEN 5
                        WHEN host_name = 'ESP32_Host6' THEN 6
                        WHEN host_name = 'ESP32_Host7' THEN 7
                        WHEN host_name = 'ESP32_Host8' THEN 8
                        ELSE NULL
                    END as current_room,
                    timestamp as last_seen,
                    rssi as last_rssi
                FROM beacon_visits bv1
                WHERE bv1.timestamp = (
                    SELECT MAX(bv2.timestamp)
                    FROM beacon_visits bv2
                    WHERE bv2.matched_uuid = bv1.matched_uuid
                )
                -- ✨ เพิ่มเงื่อนไขให้แสดงเฉพาะที่เห็นภายใน 2 นาที
                AND bv1.timestamp > NOW() - INTERVAL 2 MINUTE
            ) cv ON v.uuid = cv.matched_uuid
            WHERE v.type = 'group'
            -- ✨ เพิ่มเงื่อนไขให้แสดงเฉพาะที่ active และมี current_room
            AND v.active = TRUE
            AND cv.current_room IS NOT NULL
        `;

        const conditions = [];
        const params = [];

        // สร้างเงื่อนไขสำหรับ visitors
        if (name) {
            conditions.push(`(
                LOWER(CONCAT(COALESCE(v.first_name, ''), ' ', COALESCE(v.last_name, ''))) LIKE LOWER(?) 
                OR LOWER(v.group_name) LIKE LOWER(?)
            )`);
            params.push(`%${name}%`, `%${name}%`);
        }

        if (tag) {
            conditions.push(`LOWER(it.tag_name) LIKE LOWER(?)`);
            params.push(`%${tag}%`);
        }

        if (room) {
            conditions.push(`cv.current_room = ?`);
            params.push(parseInt(room));
        }

        if (type) {
            conditions.push(`v.type = ?`);
            params.push(type);
        }

        // สร้างเงื่อนไขสำหรับ group_members
        const memberConditions = [];
        const memberParams = [];

        if (name) {
            memberConditions.push(`(
                LOWER(CONCAT(COALESCE(gm.first_name, ''), ' ', COALESCE(gm.last_name, ''))) LIKE LOWER(?) 
                OR LOWER(v.group_name) LIKE LOWER(?)
            )`);
            memberParams.push(`%${name}%`, `%${name}%`);
        }

        if (room) {
            memberConditions.push(`cv.current_room = ?`);
            memberParams.push(parseInt(room));
        }

        // เพิ่มเงื่อนไขใน query
        if (conditions.length > 0) {
            visitorQuery += ` AND ${conditions.join(' AND ')}`;
        }

        if (memberConditions.length > 0) {
            memberQuery += ` AND ${memberConditions.join(' AND ')}`;
        }

        // รวม query ทั้งสอง
        const unionQuery = `
            (${visitorQuery})
            UNION ALL
            (${memberQuery})
            ORDER BY created_at DESC
            LIMIT 50
        `;

        console.log('📋 Search query (active only):', unionQuery);
        console.log('📋 Parameters:', [...params, ...memberParams]);

        const [rows] = await db.execute(unionQuery, [...params, ...memberParams]);
        console.log(`📊 Search found ${rows.length} active results`);

        // แปลงข้อมูล
        const searchResults = rows.map(row => {
            const displayName = createDisplayName(row);
            const displayGroup = createDisplayGroup(row);
            const formattedAge = formatAge(row.age, row.type);
            const formattedGender = formatGender(row.gender, row.type);

            // ✅ ทุกผลลัพธ์จะ active เพราะเราได้กรองแล้วใน SQL
            const active = true;

            return {
                id: row.id,
                uuid: row.uuid,
                name: displayName,
                tag: row.tag_name || `Tag${row.uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
                type: row.type,
                group: displayGroup,
                group_size: row.group_size || 1,
                age: formattedAge,
                gender: formattedGender,
                current_host: row.current_host,
                current_room: row.current_room,
                last_seen: row.last_seen,
                last_rssi: row.last_rssi,
                active: active,
                visit_date: row.visit_date,
                created_at: row.created_at,
                is_group_member: row.source_type === 'member'
            };
        });

        res.json({
            success: true,
            visitors: searchResults,
            total: searchResults.length,
            note: 'Showing only active visitors (within last 2 minutes)',
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error searching active visitors:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            visitors: []
        });
    }
});

// API สำหรับค้นหาสมาชิกในกลุ่ม - เพิ่มใหม่
app.get('/api/search-group-members/:groupUuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            members: []
        });
    }

    try {
        const groupUuid = req.params.groupUuid;
        console.log(`🔍 Searching group members for: ${groupUuid}`);

        // ค้นหากลุ่มก่อน
        const [groupRows] = await db.execute(`
            SELECT id, uuid FROM visitors 
            WHERE uuid = ? AND type = 'group' 
            ORDER BY id DESC LIMIT 1
        `, [groupUuid]);

        if (groupRows.length === 0) {
            return res.json({
                success: false,
                error: 'Group not found',
                members: []
            });
        }

        const group = groupRows[0];

        // ดึงสมาชิกกลุ่มจากตาราง group_members
        const [members] = await db.execute(`
            SELECT gm.id, gm.first_name, gm.last_name, gm.age, gm.gender, gm.created_at,
                   v.uuid as visitor_uuid,
                   it.tag_name,
                   cv.current_room, cv.last_seen, cv.last_rssi
            FROM group_members gm
            LEFT JOIN visitors v ON gm.first_name = v.first_name AND gm.last_name = v.last_name
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            LEFT JOIN (
                SELECT 
                    matched_uuid,
                    CASE 
                        WHEN host_name = 'ESP32_Host1' THEN 1
                        WHEN host_name = 'ESP32_Host2' THEN 2
                        WHEN host_name = 'ESP32_Host3' THEN 3
                        WHEN host_name = 'ESP32_Host4' THEN 4
                        WHEN host_name = 'ESP32_Host5' THEN 5
                        WHEN host_name = 'ESP32_Host6' THEN 6
                        WHEN host_name = 'ESP32_Host7' THEN 7
                        WHEN host_name = 'ESP32_Host8' THEN 8
                        ELSE NULL
                    END as current_room,
                    timestamp as last_seen,
                    rssi as last_rssi
                FROM beacon_visits bv1
                WHERE bv1.timestamp = (
                    SELECT MAX(bv2.timestamp)
                    FROM beacon_visits bv2
                    WHERE bv2.matched_uuid = bv1.matched_uuid
                    AND bv2.timestamp > NOW() - INTERVAL 2 MINUTE
                )
            ) cv ON v.uuid = cv.matched_uuid
            WHERE gm.group_visitor_id = ?
            ORDER BY gm.id ASC
        `, [group.id]);

        const memberData = members.map(member => {
            const displayName = member.first_name && member.last_name 
                ? `${member.first_name} ${member.last_name}`.trim()
                : member.first_name || member.last_name || `สมาชิก ${member.id}`;

            return {
                id: member.id,
                uuid: member.visitor_uuid || null,
                name: displayName,
                tag: member.tag_name || (member.visitor_uuid ? `Tag${member.visitor_uuid?.slice(-4)?.toUpperCase()}` : 'ไม่มี Tag'),
                age: member.age || 'ไม่ระบุ',
                gender: member.gender || 'ไม่ระบุ',
                current_room: member.current_room,
                last_seen: member.last_seen,
                last_rssi: member.last_rssi,
                active: member.last_seen && ((new Date() - new Date(member.last_seen)) / 1000 < 120)
            };
        });

        res.json({
            success: true,
            members: memberData,
            group_uuid: groupUuid,
            group_id: group.id,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error searching group members:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            members: []
        });
    }
});

// API สำหรับ Quick Search - แก้ไขให้ใช้ GET method
app.get('/api/quick-search/:type', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            visitors: []
        });
    }

    try {
        const searchType = req.params.type;
        console.log(`🚀 Quick search type: ${searchType}`);

        let baseQuery = `
            SELECT 
                v.id, v.uuid, v.type, v.first_name, v.last_name, 
                v.group_name, v.group_type, v.group_size, 
                v.age, v.gender, v.active, v.visit_date, v.created_at,
                it.tag_name,
                cv.current_host, cv.current_room, cv.last_seen, cv.last_rssi
            FROM visitors v
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            LEFT JOIN (
                SELECT 
                    matched_uuid,
                    host_name as current_host,
                    CASE 
                        WHEN host_name = 'ESP32_Host1' THEN 1
                        WHEN host_name = 'ESP32_Host2' THEN 2
                        WHEN host_name = 'ESP32_Host3' THEN 3
                        WHEN host_name = 'ESP32_Host4' THEN 4
                        WHEN host_name = 'ESP32_Host5' THEN 5
                        WHEN host_name = 'ESP32_Host6' THEN 6
                        WHEN host_name = 'ESP32_Host7' THEN 7
                        WHEN host_name = 'ESP32_Host8' THEN 8
                        ELSE NULL
                    END as current_room,
                    timestamp as last_seen,
                    rssi as last_rssi
                FROM beacon_visits bv1
                WHERE bv1.timestamp = (
                    SELECT MAX(bv2.timestamp)
                    FROM beacon_visits bv2
                    WHERE bv2.matched_uuid = bv1.matched_uuid
                )
            ) cv ON v.uuid = cv.matched_uuid
            WHERE v.id = (
                SELECT MAX(v2.id) 
                FROM visitors v2 
                WHERE v2.uuid = v.uuid 
                AND v2.visit_date >= CURDATE()
            )
        `;

        let additionalWhere = '';
        let orderBy = 'v.created_at DESC';

        switch (searchType) {
            case 'group':
                additionalWhere = "AND v.type = 'group'";
                break;
            case 'individual':
                additionalWhere = "AND v.type = 'individual'";
                break;
            case 'recent':
                // แก้ไขให้ดูจาก created_at แทน last_seen เพื่อหาคนที่ลงทะเบียนล่าสุด
                additionalWhere = 'AND v.created_at > NOW() - INTERVAL 2 HOUR';
                orderBy = 'v.created_at DESC';
                break;
            case 'active':
                additionalWhere = 'AND cv.current_room IS NOT NULL AND cv.last_seen > NOW() - INTERVAL 2 MINUTE';
                orderBy = 'cv.last_seen DESC';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid search type',
                    visitors: []
                });
        }

        const finalQuery = `${baseQuery} ${additionalWhere} ORDER BY ${orderBy} LIMIT 30`;
        
        console.log('📋 Quick search query:', finalQuery);

        const [rows] = await db.execute(finalQuery);
        console.log(`📊 Quick search "${searchType}" found ${rows.length} results`);

        // แปลงข้อมูล
        const searchResults = rows.map(row => {
            const displayName = createDisplayName(row);
            const displayGroup = createDisplayGroup(row);
            const formattedAge = formatAge(row.age, row.type);
            const formattedGender = formatGender(row.gender, row.type);

            let active = false;
            if (row.last_seen && row.current_room) {
                const timeSinceLastSeen = (new Date() - new Date(row.last_seen)) / 1000;
                active = timeSinceLastSeen < 120;
            }

            return {
                id: row.id,
                uuid: row.uuid,
                name: displayName,
                tag: row.tag_name || `Tag${row.uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
                type: row.type,
                group: displayGroup,
                group_size: row.group_size || 1,
                age: formattedAge,
                gender: formattedGender,
                current_host: row.current_host,
                current_room: row.current_room,
                last_seen: row.last_seen,
                last_rssi: row.last_rssi,
                active: active,
                visit_date: row.visit_date,
                created_at: row.created_at
            };
        });

        res.json({
            success: true,
            visitors: searchResults,
            total: searchResults.length,
            search_type: searchType,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error in quick search:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            visitors: []
        });
    }
});

// API เพิ่มเติมสำหรับดึงสมาชิกกลุ่มโดย group visitor id
app.get('/api/group-members/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            members: []
        });
    }

    try {
        const uuid = req.params.uuid;
        console.log(`🔍 Getting group members for visitor UUID: ${uuid}`);

        // ค้นหา visitor ก่อน
        const [visitorRows] = await db.execute(`
            SELECT id, type FROM visitors 
            WHERE uuid = ? AND type = 'group'
            ORDER BY id DESC LIMIT 1
        `, [uuid]);

        if (visitorRows.length === 0) {
            return res.json({
                success: false,
                error: 'Group visitor not found',
                members: []
            });
        }

        const visitor = visitorRows[0];

        // ดึงสมาชิกจาก group_members
        const [members] = await db.execute(`
            SELECT gm.id, gm.first_name, gm.last_name, gm.age, gm.gender, gm.created_at
            FROM group_members gm
            WHERE gm.group_visitor_id = ?
            ORDER BY gm.id ASC
        `, [visitor.id]);

        const memberData = members.map(member => ({
            id: member.id,
            name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || `สมาชิก ${member.id}`,
            age: member.age || 'ไม่ระบุ',
            gender: member.gender || 'ไม่ระบุ',
            created_at: member.created_at
        }));

        res.json({
            success: true,
            members: memberData,
            group_uuid: uuid,
            group_id: visitor.id,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error getting group members:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            members: []
        });
    }
});

// API สำหรับดูรายละเอียดผู้เยี่ยมชม
app.get('/api/visitor-details/:uuid', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: 'Database not available'
        });
    }

    try {
        const uuid = req.params.uuid;
        console.log(`🔍 Getting visitor details for UUID: ${uuid}`);

        // ดึงข้อมูลผู้เยี่ยมชม
        const [visitorRows] = await db.execute(`
            SELECT v.*, it.tag_name
            FROM visitors v
            LEFT JOIN ibeacons_tag it ON v.uuid = it.uuid
            WHERE v.uuid = ?
            ORDER BY v.id DESC
            LIMIT 1
        `, [uuid]);

        if (visitorRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Visitor not found'
            });
        }

        const visitor = visitorRows[0];

        // ดึงประวัติการเข้าห้อง
        const [roomHistory] = await db.execute(`
            SELECT bv.timestamp, bv.host_name, bv.rssi
            FROM beacon_visits bv
            WHERE bv.matched_uuid = ?
            ORDER BY bv.timestamp DESC
            LIMIT 20
        `, [uuid]);

        // แปลงข้อมูลห้อง
        const roomHistoryWithNames = roomHistory.map(visit => ({
            ...visit,
            room_id: HOST_ROOM_MAPPING[visit.host_name] || null,
            room_name: visit.host_name ? `ห้อง ${HOST_ROOM_MAPPING[visit.host_name]}` : 'ไม่ทราบ',
            time_ago: Math.round((new Date() - new Date(visit.timestamp)) / 1000 / 60) // นาทีที่ผ่านมา
        }));

        // ข้อมูลผู้เยี่ยมชม
        const displayName = createDisplayName(visitor);
        const displayGroup = createDisplayGroup(visitor);
        const formattedAge = formatAge(visitor.age, visitor.type);
        const formattedGender = formatGender(visitor.gender, visitor.type);

        const visitorDetails = {
            id: visitor.id,
            uuid: visitor.uuid,
            name: displayName,
            tag: visitor.tag_name || `Tag${visitor.uuid?.slice(-4)?.toUpperCase() || 'XXXX'}`,
            type: visitor.type,
            group: displayGroup,
            group_size: visitor.group_size || 1,
            age: formattedAge,
            gender: formattedGender,
            active: visitor.active,
            visit_date: visitor.visit_date,
            created_at: visitor.created_at,
            room_history: roomHistoryWithNames
        };

        res.json({
            success: true,
            visitor: visitorDetails,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error getting visitor details:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

app.get('/api/all-demographics-data', async (req, res) => {
    try {
        console.log('📊 Fetching ALL demographics data from database...');

        // Query สำหรับดึงข้อมูลจาก visitors table (เฉพาะ individual เท่านั้น) - ทุกคน
        const individualsQuery = `
            SELECT 
                age,
                CASE 
                    WHEN gender = 'male' OR gender = 'ชาย' THEN 'male'
                    WHEN gender = 'female' OR gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                'individual' as source_type,
                'individual' as visitor_type,
                visit_date
            FROM visitors 
            WHERE type = 'individual'
            AND age IS NOT NULL 
            AND age != '' 
            AND age != '0'
            AND gender IS NOT NULL 
            AND gender != ''
        `;

        // Query สำหรับดึงข้อมูลจาก group_members table - ทุกคน
        const groupMembersQuery = `
            SELECT 
                gm.age,
                CASE 
                    WHEN gm.gender = 'male' OR gm.gender = 'ชาย' THEN 'male'
                    WHEN gm.gender = 'female' OR gm.gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                'group_member' as source_type,
                'group_member' as visitor_type,
                v.visit_date
            FROM group_members gm
            INNER JOIN visitors v ON v.id = gm.group_visitor_id
            WHERE v.type = 'group'
            AND gm.age IS NOT NULL 
            AND gm.age > 0
            AND gm.gender IS NOT NULL 
            AND gm.gender != ''
        `;

        // รัน query ทั้งสอง
        const [individualsResults] = await db.execute(individualsQuery);
        const [groupMembersResults] = await db.execute(groupMembersQuery);

        console.log(`📈 Found ${individualsResults.length} individual records`);
        console.log(`📈 Found ${groupMembersResults.length} group member records`);

        // รวมข้อมูล
        const allDemographics = [
            ...individualsResults,
            ...groupMembersResults
        ];

        // แปลงอายุเป็นตัวเลขและกรองข้อมูลที่ไม่ถูกต้อง
        const processedData = allDemographics
            .map(record => ({
                age: parseInt(record.age),
                gender: record.gender.toLowerCase(),
                type: record.source_type,
                visitor_type: record.visitor_type,
                visit_date: record.visit_date
            }))
            .filter(record => 
                !isNaN(record.age) && 
                record.age > 0 && 
                record.age < 120 && 
                ['male', 'female', 'other'].includes(record.gender)
            );

        console.log(`✅ Processed ${processedData.length} valid demographics records`);
        console.log(`   - Individual visitors: ${processedData.filter(r => r.type === 'individual').length}`);
        console.log(`   - Group members: ${processedData.filter(r => r.type === 'group_member').length}`);

        // สถิติสำหรับ debugging
        const maleCount = processedData.filter(r => r.gender === 'male').length;
        const femaleCount = processedData.filter(r => r.gender === 'female').length;
        const otherCount = processedData.filter(r => r.gender === 'other').length;
        const avgAge = processedData.length > 0 ? 
            Math.round(processedData.reduce((sum, r) => sum + r.age, 0) / processedData.length) : 0;

        console.log(`   - Male: ${maleCount}, Female: ${femaleCount}, Other: ${otherCount}`);
        console.log(`   - Average age: ${avgAge} years`);

        // สถิติตามช่วงอายุ
        const ageGroups = {
            '0-2': processedData.filter(r => r.age >= 0 && r.age <= 2).length,
            '3-12': processedData.filter(r => r.age >= 3 && r.age <= 12).length,
            '13-19': processedData.filter(r => r.age >= 13 && r.age <= 19).length,
            '20-39': processedData.filter(r => r.age >= 20 && r.age <= 39).length,
            '40-59': processedData.filter(r => r.age >= 40 && r.age <= 59).length,
            '60+': processedData.filter(r => r.age >= 60).length
        };

        console.log('   - Age groups:', ageGroups);

        res.json({
            success: true,
            demographics: processedData,
            statistics: {
                total: processedData.length,
                male: maleCount,
                female: femaleCount,
                other: otherCount,
                averageAge: avgAge,
                individual: processedData.filter(r => r.type === 'individual').length,
                groupMembers: processedData.filter(r => r.type === 'group_member').length,
                ageGroups: ageGroups
            }
        });

    } catch (error) {
        console.error('❌ Error fetching all demographics data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch all demographics data',
            message: error.message
        });
    }
});

// API สำหรับดึงข้อมูลสถิติพื้นฐาน
app.get('/api/database-stats', async (req, res) => {
    try {
        console.log('📊 Fetching database statistics...');

        // นับจำนวนทั้งหมด
        const [totalVisitors] = await db.execute('SELECT COUNT(*) as total FROM visitors');
        const [activeVisitors] = await db.execute('SELECT COUNT(*) as active FROM visitors WHERE active = 1');
        const [individualVisitors] = await db.execute('SELECT COUNT(*) as individuals FROM visitors WHERE type = "individual"');
        const [groupVisitors] = await db.execute('SELECT COUNT(*) as groups FROM visitors WHERE type = "group"');
        const [groupMembers] = await db.execute('SELECT COUNT(*) as members FROM group_members');

        // ข้อมูลล่าสุด
        const [latestVisitor] = await db.execute('SELECT visit_date FROM visitors ORDER BY visit_date DESC LIMIT 1');
        const [oldestVisitor] = await db.execute('SELECT visit_date FROM visitors ORDER BY visit_date ASC LIMIT 1');

        res.json({
            success: true,
            stats: {
                totalVisitors: totalVisitors[0].total,
                activeVisitors: activeVisitors[0].active,
                individualVisitors: individualVisitors[0].individuals,
                groupVisitors: groupVisitors[0].groups,
                groupMembers: groupMembers[0].members,
                latestVisit: latestVisitor[0]?.visit_date || null,
                oldestVisit: oldestVisitor[0]?.visit_date || null
            },
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching database stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch database statistics'
        });
    }
});

// API สำหรับข้อมูลความนิยมของแต่ละห้อง
app.get('/api/room-popularity-data', async (req, res) => {
    try {
        console.log('📊 Fetching room popularity data...');

        // Query สำหรับข้อมูลสรุป (สำหรับแสดงทั้งหมด)
        const summaryQuery = `
            SELECT 
                rvs.visitor_id,
                rvs.visitor_name,
                rvs.visitor_type,
                rvs.thebest,
                rvs.visit_start,
                rvs.visit_end
            FROM room_visit_summary rvs
            WHERE rvs.thebest IS NOT NULL 
            AND rvs.thebest BETWEEN 1 AND 8
            ORDER BY rvs.visit_start DESC
        `;

        // Query สำหรับข้อมูลรายละเอียด (สำหรับกรองตามเพศและอายุ)
        // รวม individual + group members
        const detailedQuery = `
            SELECT 
                'individual' as source_type,
                v.id as visitor_id,
                v.first_name,
                v.last_name,
                v.age,
                CASE 
                    WHEN v.gender = 'male' OR v.gender = 'ชาย' THEN 'male'
                    WHEN v.gender = 'female' OR v.gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                rvs.thebest,
                rvs.visit_start,
                rvs.visit_end
            FROM visitors v
            INNER JOIN room_visit_summary rvs ON v.id = rvs.visitor_id
            WHERE v.type = 'individual'
            AND rvs.thebest IS NOT NULL 
            AND rvs.thebest BETWEEN 1 AND 8
            AND v.age IS NOT NULL 
            AND v.age != '' 
            AND v.age != '0'
            AND v.gender IS NOT NULL 
            AND v.gender != ''
            
            UNION ALL
            
            SELECT 
                'group_member' as source_type,
                gm.group_visitor_id as visitor_id,
                gm.first_name,
                gm.last_name,
                gm.age,
                CASE 
                    WHEN gm.gender = 'male' OR gm.gender = 'ชาย' THEN 'male'
                    WHEN gm.gender = 'female' OR gm.gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                rvs.thebest,
                rvs.visit_start,
                rvs.visit_end
            FROM group_members gm
            INNER JOIN visitors v ON v.id = gm.group_visitor_id
            INNER JOIN room_visit_summary rvs ON v.id = rvs.visitor_id
            WHERE v.type = 'group'
            AND rvs.thebest IS NOT NULL 
            AND rvs.thebest BETWEEN 1 AND 8
            AND gm.age IS NOT NULL 
            AND gm.age > 0
            AND gm.gender IS NOT NULL 
            AND gm.gender != ''
            
            ORDER BY visit_start DESC
        `;

        // ดำเนินการ query ทั้งสอง
        const [summaryResults] = await db.execute(summaryQuery);
        const [detailedResults] = await db.execute(detailedQuery);

        console.log(`📈 Found ${summaryResults.length} summary records`);
        console.log(`📈 Found ${detailedResults.length} detailed records`);

        // แปลงข้อมูลรายละเอียดและกรองข้อมูลที่ไม่ถูกต้อง
        const processedDetailedData = detailedResults
            .map(record => ({
                source_type: record.source_type,
                visitor_id: record.visitor_id,
                first_name: record.first_name,
                last_name: record.last_name,
                age: parseInt(record.age),
                gender: record.gender.toLowerCase(),
                thebest: record.thebest,
                visit_start: record.visit_start,
                visit_end: record.visit_end
            }))
            .filter(record => 
                !isNaN(record.age) && 
                record.age > 0 && 
                record.age < 120 && 
                ['male', 'female', 'other'].includes(record.gender) &&
                record.thebest >= 1 && record.thebest <= 8
            );

        console.log(`✅ Processed ${processedDetailedData.length} valid detailed records`);

        // สถิติสำหรับ debugging
        const roomStats = {};
        for (let i = 1; i <= 8; i++) {
            const roomKey = `room${i}`;
            roomStats[roomKey] = {
                summary: summaryResults.filter(r => r.thebest === i).length,
                detailed: processedDetailedData.filter(r => r.thebest === i).length
            };
        }

        console.log('📊 Room statistics:');
        Object.entries(roomStats).forEach(([room, stats]) => {
            console.log(`   ${room}: Summary=${stats.summary}, Detailed=${stats.detailed}`);
        });

        // สถิติตามเพศ (สำหรับ detailed data)
        const genderStats = {
            male: processedDetailedData.filter(r => r.gender === 'male').length,
            female: processedDetailedData.filter(r => r.gender === 'female').length,
            other: processedDetailedData.filter(r => r.gender === 'other').length
        };

        console.log('   Gender distribution in detailed data:', genderStats);

        // สถิติตามช่วงอายุ (สำหรับ detailed data)
        const ageStats = {
            '0-2': processedDetailedData.filter(r => r.age >= 0 && r.age <= 2).length,
            '3-12': processedDetailedData.filter(r => r.age >= 3 && r.age <= 12).length,
            '13-19': processedDetailedData.filter(r => r.age >= 13 && r.age <= 19).length,
            '20-39': processedDetailedData.filter(r => r.age >= 20 && r.age <= 39).length,
            '40-59': processedDetailedData.filter(r => r.age >= 40 && r.age <= 59).length,
            '60+': processedDetailedData.filter(r => r.age >= 60).length
        };

        console.log('   Age distribution in detailed data:', ageStats);

        res.json({
            success: true,
            summary: summaryResults,
            detailed: processedDetailedData,
            statistics: {
                totalSummaryRecords: summaryResults.length,
                totalDetailedRecords: processedDetailedData.length,
                roomStats,
                genderStats,
                ageStats
            }
        });

    } catch (error) {
        console.error('❌ Error fetching room popularity data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch room popularity data',
            message: error.message
        });
    }
});

// API สำหรับสถิติห้องพื้นฐาน
app.get('/api/room-stats', async (req, res) => {
    try {
        console.log('📊 Fetching basic room statistics...');

        // นับจำนวนคะแนนแต่ละห้อง
        const roomCountQuery = `
            SELECT 
                thebest,
                COUNT(*) as vote_count,
                visitor_type
            FROM room_visit_summary 
            WHERE thebest IS NOT NULL 
            AND thebest BETWEEN 1 AND 8
            GROUP BY thebest, visitor_type
            ORDER BY thebest
        `;

        const [roomCounts] = await db.execute(roomCountQuery);

        // นับจำนวนรวม
        const [totalVotes] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM room_visit_summary 
            WHERE thebest IS NOT NULL 
            AND thebest BETWEEN 1 AND 8
        `);

        // จัดรูปแบบข้อมูล
        const roomStats = {};
        for (let i = 1; i <= 8; i++) {
            roomStats[`room${i}`] = {
                total: 0,
                individual: 0,
                group: 0
            };
        }

        roomCounts.forEach(row => {
            const roomKey = `room${row.thebest}`;
            if (roomStats[roomKey]) {
                roomStats[roomKey].total += row.vote_count;
                if (row.visitor_type === 'individual') {
                    roomStats[roomKey].individual = row.vote_count;
                } else if (row.visitor_type === 'group') {
                    roomStats[roomKey].group = row.vote_count;
                }
            }
        });

        res.json({
            success: true,
            roomStats,
            totalVotes: totalVotes[0].total,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('❌ Error fetching room statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch room statistics'
        });
    }
});

// API สำหรับข้อมูลเวลาที่ใช้ในแต่ละห้อง (Fixed Date Filter Version)
// API สำหรับข้อมูลเวลาที่ใช้ในแต่ละห้อง (Fixed Date Filter with created_at)
app.get('/api/time-spent-data', async (req, res) => {
    try {
        console.log('🕐 Fetching time spent data...');
        
        const { startDate, endDate } = req.query;
        console.log('📅 Date filter received:', { startDate, endDate });

        // 🔧 แก้ไข: ใช้ created_at และปรับ WHERE clause ให้ถูกต้อง
        let dateFilterSQL = '';
        let dateFilterParams = [];
        
        if (startDate && endDate) {
            // กรองระหว่างวันที่ (รวมทั้งวัน)
            dateFilterSQL = ' AND DATE(rvs.created_at) BETWEEN ? AND ?';
            dateFilterParams = [startDate, endDate];
            console.log('📅 Using date range filter on created_at:', startDate, 'to', endDate);
        } else if (startDate) {
            // กรองตั้งแต่วันที่เริ่มต้น
            dateFilterSQL = ' AND DATE(rvs.created_at) >= ?';
            dateFilterParams = [startDate];
            console.log('📅 Using start date filter on created_at:', startDate);
        } else if (endDate) {
            // กรองถึงวันที่สิ้นสุด
            dateFilterSQL = ' AND DATE(rvs.created_at) <= ?';
            dateFilterParams = [endDate];
            console.log('📅 Using end date filter on created_at:', endDate);
        } else {
            console.log('📅 No date filter applied');
        }

        // 🆕 เพิ่ม: Query เพื่อตรวจสอบช่วงวันที่ทั้งหมดในฐานข้อมูล
        const dateRangeCheckQuery = `
            SELECT 
                MIN(DATE(created_at)) as earliest_date,
                MAX(DATE(created_at)) as latest_date,
                COUNT(*) as total_records
            FROM room_visit_summary
        `;

        // Query แบบง่ายๆ สำหรับ Debug - ดึงข้อมูลทั้งหมด
        const debugQuery = `
            SELECT 
                rvs.visitor_id,
                rvs.visitor_name,
                rvs.visitor_type,
                rvs.room1,
                rvs.room2,
                rvs.room3,
                rvs.room4,
                rvs.room5,
                rvs.room6,
                rvs.room7,
                rvs.room8,
                rvs.total_visit_duration,
                rvs.visit_start,
                rvs.visit_end,
                rvs.created_at,
                DATE(rvs.created_at) as created_date
            FROM room_visit_summary rvs
            ORDER BY rvs.created_at DESC
            LIMIT 10
        `;

        // 🔧 แก้ไข: Query สำหรับข้อมูลสรุป (ใช้ created_at)
        const summaryQuery = `
            SELECT 
                rvs.visitor_id,
                rvs.visitor_name,
                rvs.visitor_type,
                rvs.room1,
                rvs.room2,
                rvs.room3,
                rvs.room4,
                rvs.room5,
                rvs.room6,
                rvs.room7,
                rvs.room8,
                rvs.total_visit_duration,
                rvs.visit_start,
                rvs.visit_end,
                rvs.created_at,
                DATE(rvs.created_at) as created_date
            FROM room_visit_summary rvs
            WHERE 1=1 ${dateFilterSQL}
            ORDER BY rvs.created_at DESC
        `;

        // 🔧 แก้ไข: Query สำหรับข้อมูลรายละเอียด (ใช้ created_at)
        const detailedQuery = `
            SELECT 
                'individual' as source_type,
                v.id as visitor_id,
                v.type as visitor_type,
                v.first_name,
                v.last_name,
                v.age,
                CASE 
                    WHEN v.gender = 'male' OR v.gender = 'ชาย' THEN 'male'
                    WHEN v.gender = 'female' OR v.gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                rvs.room1,
                rvs.room2,
                rvs.room3,
                rvs.room4,
                rvs.room5,
                rvs.room6,
                rvs.room7,
                rvs.room8,
                rvs.total_visit_duration,
                rvs.visit_start,
                rvs.visit_end,
                rvs.created_at,
                DATE(rvs.created_at) as created_date
            FROM visitors v
            INNER JOIN room_visit_summary rvs ON v.id = rvs.visitor_id
            WHERE v.type = 'individual'
            ${dateFilterSQL}
            
            UNION ALL
            
            SELECT 
                'group_member' as source_type,
                gm.group_visitor_id as visitor_id,
                v.type as visitor_type,
                gm.first_name,
                gm.last_name,
                gm.age,
                CASE 
                    WHEN gm.gender = 'male' OR gm.gender = 'ชาย' THEN 'male'
                    WHEN gm.gender = 'female' OR gm.gender = 'หญิง' THEN 'female'
                    ELSE 'other'
                END as gender,
                rvs.room1,
                rvs.room2,
                rvs.room3,
                rvs.room4,
                rvs.room5,
                rvs.room6,
                rvs.room7,
                rvs.room8,
                rvs.total_visit_duration,
                rvs.visit_start,
                rvs.visit_end,
                rvs.created_at,
                DATE(rvs.created_at) as created_date
            FROM group_members gm
            INNER JOIN visitors v ON v.id = gm.group_visitor_id
            INNER JOIN room_visit_summary rvs ON v.id = rvs.visitor_id
            WHERE v.type = 'group'
            ${dateFilterSQL}
            
            ORDER BY created_at DESC
        `;

        // ดำเนินการ query
        console.log('🔍 Executing queries...');
        
        const [dateRangeCheck] = await db.execute(dateRangeCheckQuery);
        const [debugResults] = await db.execute(debugQuery);
        const [summaryResults] = await db.execute(summaryQuery, dateFilterParams);
        const [detailedResults] = await db.execute(detailedQuery, [...dateFilterParams, ...dateFilterParams]);

        // 🆕 แสดงข้อมูลช่วงวันที่ในฐานข้อมูล
        if (dateRangeCheck.length > 0) {
            const dbInfo = dateRangeCheck[0];
            console.log('📊 Database date range info:');
            console.log(`   - Earliest date: ${dbInfo.earliest_date}`);
            console.log(`   - Latest date: ${dbInfo.latest_date}`);
            console.log(`   - Total records: ${dbInfo.total_records}`);
        }

        console.log(`🔍 Debug: Found ${debugResults.length} recent records (limit 10)`);
        console.log(`🕐 Summary: Found ${summaryResults.length} summary records (with date filter)`);
        console.log(`🕐 Detailed: Found ${detailedResults.length} detailed records (with date filter)`);

        // 🆕 แสดงตัวอย่างข้อมูลล่าสุดใน DB
        if (debugResults.length > 0) {
            console.log('📊 Latest records in DB:');
            debugResults.slice(0, 5).forEach((record, index) => {
                const createdDate = record.created_date || 'No date';
                const roomTimes = [];
                for (let i = 1; i <= 8; i++) {
                    const time = parseInt(record[`room${i}`]) || 0;
                    if (time > 0) roomTimes.push(`room${i}=${time}min`);
                }
                console.log(`   [${index + 1}] ID:${record.visitor_id} - Created: ${createdDate} - ${roomTimes.join(', ') || 'No room time'}`);
            });
        }

        // ตรวจสอบผลลัพธ์การกรอง
        if (startDate || endDate) {
            console.log('📊 Date filtering results:');
            console.log(`   - Filter: ${startDate || 'any'} to ${endDate || 'any'}`);
            console.log(`   - Records found: ${summaryResults.length}`);
            
            if (summaryResults.length === 0) {
                console.log('⚠️  No records found for the specified date range!');
                console.log('💡 Try checking if the date format matches your database dates');
            } else {
                // แสดงตัวอย่างวันที่ที่พบหลังกรอง
                const foundDates = [...new Set(summaryResults.map(r => r.created_date))].slice(0, 5);
                console.log(`   - Sample filtered dates: ${foundDates.join(', ')}`);
                
                // แสดงตัวอย่างข้อมูลที่ถูกกรอง
                console.log('📊 Filtered records sample:');
                summaryResults.slice(0, 3).forEach((record, index) => {
                    const roomTimes = [];
                    for (let i = 1; i <= 8; i++) {
                        const time = parseInt(record[`room${i}`]) || 0;
                        if (time > 0) roomTimes.push(`room${i}=${time}min`);
                    }
                    console.log(`   [${index + 1}] ID:${record.visitor_id} - Date: ${record.created_date} - ${roomTimes.join(', ') || 'No room time'}`);
                });
            }
        }

        // แปลงข้อมูลสรุป
        const processedSummaryData = summaryResults.map(record => ({
            visitor_id: record.visitor_id,
            visitor_name: record.visitor_name,
            visitor_type: record.visitor_type,
            room1: parseInt(record.room1) || 0,
            room2: parseInt(record.room2) || 0,
            room3: parseInt(record.room3) || 0,
            room4: parseInt(record.room4) || 0,
            room5: parseInt(record.room5) || 0,
            room6: parseInt(record.room6) || 0,
            room7: parseInt(record.room7) || 0,
            room8: parseInt(record.room8) || 0,
            total_visit_duration: parseInt(record.total_visit_duration) || 0,
            visit_start: record.visit_start,
            visit_end: record.visit_end,
            created_at: record.created_at,
            created_date: record.created_date
        }));

        // แปลงข้อมูลรายละเอียด
        const processedDetailedData = detailedResults.map(record => ({
            source_type: record.source_type,
            visitor_id: record.visitor_id,
            visitor_type: record.visitor_type,
            first_name: record.first_name,
            last_name: record.last_name,
            age: parseInt(record.age) || 0,
            gender: (record.gender || '').toLowerCase(),
            room1: parseInt(record.room1) || 0,
            room2: parseInt(record.room2) || 0,
            room3: parseInt(record.room3) || 0,
            room4: parseInt(record.room4) || 0,
            room5: parseInt(record.room5) || 0,
            room6: parseInt(record.room6) || 0,
            room7: parseInt(record.room7) || 0,
            room8: parseInt(record.room8) || 0,
            total_visit_duration: parseInt(record.total_visit_duration) || 0,
            visit_start: record.visit_start,
            visit_end: record.visit_end,
            created_at: record.created_at,
            created_date: record.created_date
        }));

        console.log(`✅ Processed ${processedSummaryData.length} summary records`);
        console.log(`✅ Processed ${processedDetailedData.length} detailed records`);

        // คำนวณสถิติรวมตามห้อง
        const roomTimeStats = {};
        const roomNames = ['room1', 'room2', 'room3', 'room4', 'room5', 'room6', 'room7', 'room8'];
        
        for (const roomKey of roomNames) {
            const summaryTotalTime = processedSummaryData.reduce((sum, record) => {
                return sum + (record[roomKey] || 0);
            }, 0);
            
            roomTimeStats[roomKey] = {
                summaryTotalMinutes: summaryTotalTime,
                summaryRecordsWithTime: processedSummaryData.filter(r => (r[roomKey] || 0) > 0).length
            };
        }

        // 🆕 Debug: แสดงผลรวมเวลาในแต่ละห้อง
        console.log('🕐 Final room time totals (from filtered data):');
        Object.entries(roomTimeStats).forEach(([room, stats]) => {
            if (stats.summaryTotalMinutes > 0) {
                console.log(`   ${room}: ${stats.summaryTotalMinutes} minutes (${stats.summaryRecordsWithTime} visits)`);
            }
        });

        // ข้อมูลการกรองตามวันที่
        let dateFilterInfo = null;
        if (startDate || endDate) {
            dateFilterInfo = {
                startDate: startDate || null,
                endDate: endDate || null,
                recordsFound: processedSummaryData.length,
                filterApplied: true,
                dbDateRange: dateRangeCheck.length > 0 ? {
                    earliest: dateRangeCheck[0].earliest_date,
                    latest: dateRangeCheck[0].latest_date,
                    total: dateRangeCheck[0].total_records
                } : null
            };
            console.log('📅 Final date filter info:', dateFilterInfo);
        }

        res.json({
            success: true,
            summary: processedSummaryData,
            detailed: processedDetailedData,
            debug: {
                totalRecordsInDB: dateRangeCheck.length > 0 ? dateRangeCheck[0].total_records : 0,
                filteredRecords: summaryResults.length,
                latestRecords: debugResults.slice(0, 5).map(r => ({
                    visitor_id: r.visitor_id,
                    visitor_type: r.visitor_type,
                    created_at: r.created_at,
                    created_date: r.created_date,
                    room_times: [r.room1, r.room2, r.room3, r.room4, r.room5, r.room6, r.room7, r.room8]
                }))
            },
            statistics: {
                totalSummaryRecords: processedSummaryData.length,
                totalDetailedRecords: processedDetailedData.length,
                roomTimeStats,
                dateFilter: dateFilterInfo
            }
        });

    } catch (error) {
        console.error('❌ Error fetching time spent data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch time spent data',
            message: error.message,
            stack: error.stack
        });
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
        console.log(`👥 Group members API: http://localhost:${PORT}/api/group-members/{uuid}`);
        
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