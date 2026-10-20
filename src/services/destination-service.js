import { one } from '../db/database.js';
import { normalizeAccount, normalizeEsoOwner, stripLeadingAt } from '../utils/eso.js';
import { requireEsoServer } from '../utils/eso-server.js';

function isUniqueViolation(error){
  return Number(error?.errcode)===2067||error?.code==='ER_DUP_ENTRY'||error?.code==='SQLITE_CONSTRAINT_UNIQUE';
}

export class DestinationService{
  constructor(db){this.db=db;}

  async resolve({esoServer,esoOwner,houseId},conn=this.db){
    const server=requireEsoServer(esoServer);
    const owner=stripLeadingAt(normalizeEsoOwner(esoOwner));
    const normalizedOwner=normalizeAccount(owner);
    const numericHouseId=Number(houseId);
    if(!Number.isInteger(numericHouseId)||numericHouseId<=0)throw new Error('A valid ESO owner and official house ID are required.');
    const existing=await one(conn,'SELECT * FROM housing_destinations WHERE eso_server=? AND normalized_owner=? AND house_id=?',[server,normalizedOwner,numericHouseId]);
    if(existing)return existing;
    try{
      await conn.query('INSERT INTO housing_destinations(eso_server,eso_owner,normalized_owner,house_id) VALUES(?,?,?,?)',[server,owner,normalizedOwner,numericHouseId]);
    }catch(error){
      if(!isUniqueViolation(error))throw error;
    }
    return one(conn,'SELECT * FROM housing_destinations WHERE eso_server=? AND normalized_owner=? AND house_id=?',[server,normalizedOwner,numericHouseId]);
  }

  get(id,conn=this.db){
    return one(conn,'SELECT * FROM housing_destinations WHERE id=?',[Number(id)]);
  }
}
