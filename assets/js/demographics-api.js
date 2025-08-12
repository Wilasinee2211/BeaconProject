// ====================================
// Demographics API Endpoint
// เพิ่มใน Express.js server ของคุณ
// ====================================

/**
 * API สำหรับดึงข้อมูล demographics ของผู้เยี่ยมชม
 * รวมข้อมูลจาก visitors table และ group_members table
 */

// เพิ่ม endpoint นี้ในไฟล์ server ของคุณ
app.get('/api/demographics-data', async (req, res) => {
    try {
        console.log('📊 Fetching demographics data...');

        // Query สำหรับดึงข้อมูลจาก visitors table (individual และ group leaders)
        const visitorsQuery = `
            SELECT 
                age,
                CASE 
                    WHEN gender = 'male' OR gender = 'ชาย' THEN 'male'
                    WHEN gender = 'female' OR gender = 'หญิง' THEN 'female'
                    ELSE gender
                END as gender,
                'individual' as source_type,
                type as visitor_type
            FROM visitors 
            WHERE active = 1 
            AND age IS NOT NULL 
            AND age != '' 
            AND gender IS NOT NULL 
            AND gender != ''
            AND (type = 'individual' OR type = 'group')
        `;

        // Query สำหรับดึงข้อมูลจาก group_members table
        const groupMembersQuery = `
            SELECT 
                gm.age,
                CASE 
                    WHEN gm.gender = 'male' OR gm.gender = 'ชาย' THEN 'male'
                    WHEN gm.gender = 'female' OR gm.gender = 'หญิง' THEN 'female'
                    ELSE gm.gender
                END as gender,
                'group_member' as source_type,
                'group_member' as visitor_type
            FROM group_members gm
            INNER JOIN visitors v ON v.id = gm.group_visitor_id
            WHERE v.active = 1
            AND gm.age IS NOT NULL 
            AND gm.age > 0
            AND gm.gender IS NOT NULL 
            AND gm.gender != ''
        `;

        // รัน query ทั้งสอง
        const [visitorsResults] = await db.execute(visitorsQuery);
        const [groupMembersResults] = await db.execute(groupMembersQuery);

        // รวมข้อมูล
        const allDemographics = [
            ...visitorsResults,
            ...groupMembersResults
        ];

        // แปลงอายุเป็นตัวเลขและกรองข้อมูลที่ไม่ถูกต้อง
        const processedData = allDemographics
            .map(record => ({
                age: parseInt(record.age),
                gender: record.gender.toLowerCase(),
                type: record.source_type,
                visitor_type: record.visitor_type
            }))
            .filter(record => 
                !isNaN(record.age) && 
                record.age > 0 && 
                record.age < 150 && 
                (record.gender === 'male' || record.gender === 'female')
            );

        console.log(`✅ Found ${processedData.length} demographics records`);
        console.log(`   - Individual visitors: ${processedData.filter(r => r.type === 'individual').length}`);
        console.log(`   - Group members: ${processedData.filter(r => r.type === 'group_member').length}`);

        // สถิติสำหรับ debugging
        const maleCount = processedData.filter(r => r.gender === 'male').length;
        const femaleCount = processedData.filter(r => r.gender === 'female').length;
        const avgAge = Math.round(processedData.reduce((sum, r) => sum + r.age, 0) / processedData.length);

        console.log(`   - Male: ${maleCount}, Female: ${femaleCount}`);
        console.log(`   - Average age: ${avgAge} years`);

        res.json({
            success: true,
            demographics: processedData,
            statistics: {
                total: processedData.length,
                male: maleCount,
                female: femaleCount,
                averageAge: avgAge,
                individual: processedData.filter(r => r.type === 'individual').length,
                groupMembers: processedData.filter(r => r.type === 'group_member').length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching demographics data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch demographics data',
            message: error.message
        });
    }
});

// ====================================
// Alternative Queries สำหรับกรณีต่างๆ
// ====================================

/**
 * Query สำหรับดึงข้อมูล demographics แยกตามช่วงเวลา
 */
app.get('/api/demographics-data/by-date', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        let queryParams = [];
        
        if (startDate && endDate) {
            dateFilter = 'AND DATE(v.visit_date) BETWEEN ? AND ?';
            queryParams = [startDate, endDate];
        } else if (startDate) {
            dateFilter = 'AND DATE(v.visit_date) >= ?';
            queryParams = [startDate];
        } else if (endDate) {
            dateFilter = 'AND DATE(v.visit_date) <= ?';
            queryParams = [endDate];
        }

        const query = `
            SELECT 
                age,
                gender,
                'individual' as source_type,
                DATE(visit_date) as visit_date
            FROM visitors 
            WHERE active = 1 
            AND age IS NOT NULL 
            AND gender IS NOT NULL
            ${dateFilter}
            
            UNION ALL
            
            SELECT 
                gm.age,
                gm.gender,
                'group_member' as source_type,
                DATE(v.visit_date) as visit_date
            FROM group_members gm
            INNER JOIN visitors v ON v.id = gm.group_visitor_id
            WHERE v.active = 1
            AND gm.age IS NOT NULL 
            AND gm.gender IS NOT NULL
            ${dateFilter}
            
            ORDER BY visit_date DESC
        `;

        const [results] = await db.execute(query, [...queryParams, ...queryParams]);
        
        res.json({
            success: true,
            demographics: results.map(record => ({
                age: parseInt(record.age),
                gender: record.gender.toLowerCase(),
                type: record.source_type,
                visitDate: record.visit_date
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching demographics by date:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch demographics data by date'
        });
    }
});

/**
 * Query สำหรับสถิติ demographics แบบสรุป
 */
app.get('/api/demographics-summary', async (req, res) => {
    try {
        const summaryQuery = `
            SELECT 
                COUNT(*) as total_count,
                AVG(age) as avg_age,
                MIN(age) as min_age,
                MAX(age) as max_age,
                SUM(CASE WHEN gender IN ('male', 'ชาย') THEN 1 ELSE 0 END) as male_count,
                SUM(CASE WHEN gender IN ('female', 'หญิง') THEN 1 ELSE 0 END) as female_count,
                SUM(CASE WHEN age BETWEEN 0 AND 14 THEN 1 ELSE 0 END) as age_0_14,
                SUM(CASE WHEN age BETWEEN 15 AND 25 THEN 1 ELSE 0 END) as age_15_25,
                SUM(CASE WHEN age BETWEEN 26 AND 40 THEN 1 ELSE 0 END) as age_26_40,
                SUM(CASE WHEN age BETWEEN 41 AND 60 THEN 1 ELSE 0 END) as age_41_60,
                SUM(CASE WHEN age > 60 THEN 1 ELSE 0 END) as age_60_plus
            FROM (
                SELECT age, gender FROM visitors 
                WHERE active = 1 AND age IS NOT NULL AND gender IS NOT NULL
                UNION ALL
                SELECT gm.age, gm.gender FROM group_members gm
                INNER JOIN visitors v ON v.id = gm.group_visitor_id
                WHERE v.active = 1 AND gm.age IS NOT NULL AND gm.gender IS NOT NULL
            ) as combined_demographics
        `;

        const [results] = await db.execute(summaryQuery);
        const summary = results[0];

        res.json({
            success: true,
            summary: {
                total: parseInt(summary.total_count),
                averageAge: Math.round(summary.avg_age),
                ageRange: {
                    min: parseInt(summary.min_age),
                    max: parseInt(summary.max_age)
                },
                genderDistribution: {
                    male: parseInt(summary.male_count),
                    female: parseInt(summary.female_count),
                    malePercentage: Math.round((summary.male_count / summary.total_count) * 100),
                    femalePercentage: Math.round((summary.female_count / summary.total_count) * 100)
                },
                ageGroupDistribution: {
                    '0-14': parseInt(summary.age_0_14),
                    '15-25': parseInt(summary.age_15_25),
                    '26-40': parseInt(summary.age_26_40),
                    '41-60': parseInt(summary.age_41_60),
                    '60+': parseInt(summary.age_60_plus)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching demographics summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch demographics summary'
        });
    }
});

// ====================================
// Export สำหรับ module.exports (ถ้าใช้)
// ====================================
module.exports = {
    // ฟังก์ชันที่สามารถใช้ในส่วนอื่นได้
    getDemographicsData: async (db) => {
        // Implementation here
    }
};