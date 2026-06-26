import db from './index.js';

function ensureColumn(tableName, columnName, definition) {
  if (!db.columnExists(tableName, columnName)) {
    db.addColumn(tableName, definition);
  }
}

function ensureProjectTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_units INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      sales_start_date TEXT,
      sales_end_date TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('project', 'total_units', 'total_units INTEGER DEFAULT 0');
  ensureColumn('project', 'status', "status TEXT DEFAULT 'active'");
  ensureColumn('project', 'sales_start_date', 'sales_start_date TEXT');
  ensureColumn('project', 'sales_end_date', 'sales_end_date TEXT');
  ensureColumn('project', 'remark', 'remark TEXT');
  ensureColumn('project', 'updated_at', 'updated_at TEXT');
}

function ensureBuildingTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS building (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      total_units INTEGER DEFAULT 0,
      opened_units INTEGER DEFAULT 0,
      sold_units INTEGER DEFAULT 0,
      unsold_units INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('building', 'project_id', 'project_id INTEGER');
  ensureColumn('building', 'total_units', 'total_units INTEGER DEFAULT 0');
  ensureColumn('building', 'opened_units', 'opened_units INTEGER DEFAULT 0');
  ensureColumn('building', 'sold_units', 'sold_units INTEGER DEFAULT 0');
  ensureColumn('building', 'unsold_units', 'unsold_units INTEGER DEFAULT 0');
  ensureColumn('building', 'status', "status TEXT DEFAULT 'active'");
  ensureColumn('building', 'updated_at', 'updated_at TEXT');
}

function ensureUnitTypeTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS unit_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      room_layout TEXT,
      area REAL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('unit_type', 'project_id', 'project_id INTEGER');
  ensureColumn('unit_type', 'room_layout', 'room_layout TEXT');
  ensureColumn('unit_type', 'area', 'area REAL');
  ensureColumn('unit_type', 'description', 'description TEXT');
  ensureColumn('unit_type', 'status', "status TEXT DEFAULT 'active'");
  ensureColumn('unit_type', 'updated_at', 'updated_at TEXT');
}

function ensureBuildingUnitTypeTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS building_unit_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      unit_type_id INTEGER NOT NULL,
      total_units INTEGER DEFAULT 0,
      sold_units INTEGER DEFAULT 0,
      unsold_units INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('building_unit_type', 'total_units', 'total_units INTEGER DEFAULT 0');
  ensureColumn('building_unit_type', 'sold_units', 'sold_units INTEGER DEFAULT 0');
  ensureColumn('building_unit_type', 'unsold_units', 'unsold_units INTEGER DEFAULT 0');
  ensureColumn('building_unit_type', 'created_at', 'created_at TEXT');
  ensureColumn('building_unit_type', 'updated_at', 'updated_at TEXT');

  if (db.columnExists('building_unit_type', 'total')) {
    db.exec('UPDATE building_unit_type SET total_units = COALESCE(NULLIF(total_units, 0), total)');
  }
  if (db.columnExists('building_unit_type', 'sold')) {
    db.exec('UPDATE building_unit_type SET sold_units = COALESCE(NULLIF(sold_units, 0), sold)');
  }
  if (db.columnExists('building_unit_type', 'unsold')) {
    db.exec('UPDATE building_unit_type SET unsold_units = COALESCE(NULLIF(unsold_units, 0), unsold)');
  }
}

function ensureDailySignRecordTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_sign_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      building_id INTEGER NOT NULL,
      sign_date TEXT NOT NULL,
      available_units INTEGER DEFAULT 0,
      adjustment_units INTEGER DEFAULT 0,
      adjustment_reason TEXT,
      derived_sold_units INTEGER DEFAULT 0,
      cumulative_sold_units INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      import_batch_id INTEGER,
      remark TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sign_date, building_id)
    )
  `);
}

function ensureUnitTypeSaleRecordTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS unit_type_sale_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      building_id INTEGER NOT NULL,
      unit_type_id INTEGER NOT NULL,
      sign_date TEXT NOT NULL,
      sold_units INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      import_batch_id INTEGER,
      remark TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sign_date, building_id, unit_type_id)
    )
  `);
}

function seedDefaults() {
  let project = db.get('SELECT * FROM project ORDER BY id ASC LIMIT 1');
  if (!project) {
    const id = db.insert('project', {
      name: '默认楼盘',
      total_units: 0,
      status: 'active',
      created_at: db.now(),
      updated_at: db.now()
    });
    project = db.get('SELECT * FROM project WHERE id=:id', { id });
  }

  db.run('UPDATE building SET project_id=:project_id WHERE project_id IS NULL', { project_id: project.id });
  db.run('UPDATE unit_type SET project_id=:project_id WHERE project_id IS NULL', { project_id: project.id });

  const hasUnitTypes = db.get('SELECT * FROM unit_type WHERE project_id=:project_id LIMIT 1', { project_id: project.id });
  if (!hasUnitTypes) {
    for (const name of ['105', '116', '130', '136', '172']) {
      db.insert('unit_type', {
        project_id: project.id,
        name,
        description: `${name}户型`,
        status: 'active',
        created_at: db.now(),
        updated_at: db.now()
      });
    }
  }
}

export async function initDatabase() {
  ensureProjectTable();
  ensureBuildingTable();
  ensureUnitTypeTable();
  ensureBuildingUnitTypeTable();
  ensureDailySignRecordTable();
  ensureUnitTypeSaleRecordTable();
  seedDefaults();
}
