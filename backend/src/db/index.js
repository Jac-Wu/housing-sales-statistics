import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

// 支持通过环境变量指定数据目录
const dataDir = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });

const database = new DatabaseSync(path.join(dataDir, 'housing_sales.db'));
database.exec('PRAGMA foreign_keys = ON');

export function exec(sql) {
  return database.exec(sql);
}

export function all(sql, params = {}) {
  return database.prepare(sql).all(params);
}

export function get(sql, params = {}) {
  return database.prepare(sql).get(params);
}

export function run(sql, params = {}) {
  return database.prepare(sql).run(params);
}

export function insert(table, data) {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  const columns = keys.join(', ');
  const placeholders = keys.map((key) => `:${key}`).join(', ');
  const result = run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, data);
  return Number(result.lastInsertRowid);
}

export function update(table, data, where, whereSql = null) {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  const setSql = keys.map((key) => `${key} = :${key}`).join(', ');
  const condition = whereSql || Object.keys(where).map((key) => `${key} = :where_${key}`).join(' AND ');
  const params = { ...data };
  for (const [key, value] of Object.entries(where || {})) {
    params[`where_${key}`] = value;
  }
  return run(`UPDATE ${table} SET ${setSql} WHERE ${condition}`, params);
}

export function remove(table, where) {
  const condition = Object.keys(where).map((key) => `${key} = :${key}`).join(' AND ');
  return run(`DELETE FROM ${table} WHERE ${condition}`, where);
}

export function tableExists(tableName) {
  const row = get("SELECT name FROM sqlite_master WHERE type='table' AND name=:tableName", { tableName });
  return Boolean(row);
}

export function columnExists(tableName, columnName) {
  const rows = all(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

export function addColumn(tableName, definition) {
  exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

export function now() {
  return new Date().toISOString();
}

export default {
  exec,
  all,
  get,
  run,
  insert,
  update,
  remove,
  tableExists,
  columnExists,
  addColumn,
  now
};
