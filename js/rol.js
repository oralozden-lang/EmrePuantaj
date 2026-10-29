// rol.js — app.js (v180) satırları 181-185. Otomatik bölündü; davranış değişmedi.
import { S } from './durum.js';

/* ================= Rol ================= */
export const rol=()=>S.me&&S.me.rol;
export const isIsveren=()=>rol()==='isveren', isBolge=()=>rol()==='bolge', isSube=()=>rol()==='sube';
export const puantajYetki=()=>isIsveren()||isBolge();

