import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import db from '../db/index.js';
import { recalculateBuildingFrom, toInt, updateProjectTotalUnits } from '../services/sales.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件', errors: [] });

    const { project_id } = req.body;
    const project = project_id
      ? db.get('SELECT * FROM project WHERE id=:id', { id: project_id })
      : db.get('SELECT * FROM project ORDER BY id ASC LIMIT 1');
    if (!project) return res.status(400).json({ code: 400, message: '请先创建楼盘', errors: [] });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    const unitTypes = db.all('SELECT * FROM unit_type WHERE project_id=:project_id', { project_id: project.id });
    const unitTypeMap = new Map(unitTypes.map((item) => [item.name, item.id]));
    const importedBuildings = [];
    const errors = [];

    for (const row of rows) {
      try {
        const buildingName = row['楼栋'] || row['楼栋名称'] || row['名称'] || row.building_name;
        if (!buildingName) continue;

        const totalUnits = toInt(row['总房源'] || row['总户数'] || row.total_units);
        const availableUnits = toInt(row['可售'] || row['可售套数'] || row['未售'] || row.available_units, totalUnits);
        const soldUnits = Math.max(totalUnits - availableUnits, 0);
        let building = db.get(
          'SELECT * FROM building WHERE project_id=:project_id AND name=:name',
          { project_id: project.id, name: String(buildingName) }
        );

        if (building) {
          db.update('building', {
            total_units: totalUnits,
            sold_units: soldUnits,
            unsold_units: availableUnits,
            updated_at: db.now()
          }, { id: building.id });
        } else {
          const id = db.insert('building', {
            project_id: project.id,
            name: String(buildingName),
            total_units: totalUnits,
            sold_units: soldUnits,
            unsold_units: availableUnits,
            status: 'active',
            created_at: db.now(),
            updated_at: db.now()
          });
          building = { id, project_id: project.id, name: String(buildingName) };
        }

        for (const [unitTypeName, unitTypeId] of unitTypeMap.entries()) {
          const total = row[`${unitTypeName}总数`] ?? row[`${unitTypeName}总量`];
          if (total === undefined) continue;
          const totalByType = toInt(total);
          const soldByType = toInt(row[`${unitTypeName}已售`] || 0);
          db.run(
            'DELETE FROM building_unit_type WHERE building_id=:building_id AND unit_type_id=:unit_type_id',
            { building_id: building.id, unit_type_id: unitTypeId }
          );
          db.insert('building_unit_type', {
            building_id: building.id,
            unit_type_id: unitTypeId,
            total_units: totalByType,
            sold_units: soldByType,
            unsold_units: Math.max(totalByType - soldByType, 0),
            created_at: db.now(),
            updated_at: db.now()
          });
        }

        if (row['日期'] || row.sign_date) {
          const signDate = row['日期'] || row.sign_date;
          db.run(
            'DELETE FROM daily_sign_record WHERE building_id=:building_id AND sign_date=:sign_date',
            { building_id: building.id, sign_date: signDate }
          );
          db.insert('daily_sign_record', {
            project_id: project.id,
            building_id: building.id,
            sign_date: signDate,
            available_units: availableUnits,
            adjustment_units: toInt(row['调整套数'] || row.adjustment_units),
            adjustment_reason: row['调整原因'] || '',
            source: 'excel',
            created_at: db.now(),
            updated_at: db.now()
          });
          await recalculateBuildingFrom(building.id);
        }

        importedBuildings.push(String(buildingName));
      } catch (err) {
        errors.push(`楼栋 ${row['楼栋'] || row.building_name || '-'} 导入失败: ${err.message}`);
      }
    }

    await updateProjectTotalUnits(project.id);
    res.json({
      code: 0,
      message: '导入完成',
      data: { imported_count: importedBuildings.length, buildings: importedBuildings, errors }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/template', (req, res) => {
  const template = [
    {
      楼栋: '1幢',
      总房源: 100,
      可售套数: 84,
      日期: '2026-01-24',
      调整套数: 0,
      调整原因: '',
      '105总数': 40,
      '116总数': 60
    }
  ];

  const ws = xlsx.utils.json_to_sheet(template);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, '导入模板');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
  res.send(xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }));
});

export default router;
