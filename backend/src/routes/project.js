import express from 'express';
import db from '../db/index.js';
import { updateProjectTotalUnits, toInt } from '../services/sales.js';

const router = express.Router();

router.get('/list', async (req, res, next) => {
  try {
    const projects = db.all('SELECT * FROM project ORDER BY created_at ASC, id ASC');
    res.json({ code: 0, message: 'success', data: projects });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await updateProjectTotalUnits(req.params.id);
    const project = db.get('SELECT * FROM project WHERE id=:id', { id: req.params.id });
    if (!project) return res.status(404).json({ code: 404, message: '楼盘不存在', errors: [] });
    res.json({ code: 0, message: 'success', data: project });
  } catch (err) {
    next(err);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const {
      name,
      total_units = 0,
      status = 'active',
      sales_start_date = null,
      sales_end_date = null,
      remark = ''
    } = req.body;

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '楼盘名称不能为空',
        errors: [{ field: 'name', message: '楼盘名称不能为空' }]
      });
    }

    const id = db.insert('project', {
      name,
      total_units: toInt(total_units),
      status,
      sales_start_date,
      sales_end_date,
      remark,
      created_at: db.now(),
      updated_at: db.now()
    });

    res.json({ code: 0, message: '创建成功', data: { id } });
  } catch (err) {
    next(err);
  }
});

router.put('/update/:id', async (req, res, next) => {
  try {
    const {
      name,
      total_units,
      status = 'active',
      sales_start_date = null,
      sales_end_date = null,
      remark = ''
    } = req.body;

    db.update('project', {
      name,
      total_units: total_units === undefined ? undefined : toInt(total_units),
      status,
      sales_start_date,
      sales_end_date,
      remark,
      updated_at: db.now()
    }, { id: req.params.id });

    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', async (req, res, next) => {
  try {
    const building = db.get('SELECT id FROM building WHERE project_id=:project_id LIMIT 1', {
      project_id: req.params.id
    });
    if (building) {
      return res.status(422).json({
        code: 422,
        message: '该楼盘已有楼栋数据，不允许删除',
        errors: [{ field: 'project_id', message: '请先删除楼栋数据' }]
      });
    }

    db.remove('project', { id: req.params.id });
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

export default router;
