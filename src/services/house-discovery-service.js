import crypto from 'node:crypto';
import { houseTarget, houseTargetKey } from '../utils/house-target.js';

export class HouseDiscoveryService{
  constructor({randomInt=crypto.randomInt}={}){this.randomInt=randomInt;}
  choose(rows,{previousTargetKey=null}={}){
    const source=Array.isArray(rows)?rows:[];
    const eligible=source.filter(row=>houseTargetKey(houseTarget(row))!==previousTargetKey);
    const pool=eligible.length?eligible:source;
    return pool.length?pool[this.randomInt(pool.length)]:null;
  }
}
