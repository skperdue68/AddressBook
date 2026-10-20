import crypto from 'node:crypto';

export class ShareTokenService{
  issue(){
    const token=crypto.randomBytes(24).toString('base64url');
    return {token,hash:this.hash(token)};
  }

  hash(token){
    return crypto.createHash('sha256').update(String(token),'utf8').digest('hex');
  }

  matches(token,expectedHash){
    if(!/^[a-f0-9]{64}$/i.test(String(expectedHash||'')))return false;
    const actual=Buffer.from(this.hash(token),'hex'),expected=Buffer.from(String(expectedHash),'hex');
    return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
  }
}
