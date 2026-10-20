const positive=(value,fallback)=>{
  const number=Number(value);
  return Number.isFinite(number)&&number>0?Math.floor(number):fallback;
};

export function rateLimitSettings(env=process.env){
  return {
    share:{limit:positive(env.SHARE_PASS_RATE_LIMIT,5),windowMs:positive(env.SHARE_PASS_RATE_WINDOW_SECONDS,300)*1000},
    shareAccess:{limit:positive(env.SHARE_PASS_ACCESS_RATE_LIMIT,60),windowMs:positive(env.SHARE_PASS_ACCESS_RATE_WINDOW_SECONDS,300)*1000},
    report:{limit:positive(env.HOUSING_REPORT_RATE_LIMIT,5),windowMs:positive(env.HOUSING_REPORT_RATE_WINDOW_SECONDS,600)*1000}
  };
}

export class RateLimitService{
  constructor({clock=()=>Date.now()}={}){this.clock=clock;this.events=new Map();}

  consume({bucket,userId,limit,windowMs}){
    const now=this.clock(),key=`${bucket}:${userId}`,cutoff=now-windowMs;
    const recent=(this.events.get(key)||[]).filter(time=>time>cutoff);
    if(recent.length>=limit){
      this.events.set(key,recent);
      return {allowed:false,retryAfterMs:Math.max(1,recent[0]+windowMs-now)};
    }
    recent.push(now);this.events.set(key,recent);
    return {allowed:true,retryAfterMs:0};
  }
}
