// Local synthetic-data benchmark. Never run against a hosted database.
import {randomUUID} from 'node:crypto'
import {writeFile,mkdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
const url=new URL(process.env.DATABASE_URL||'http://invalid')
if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.includes('test'))throw Error('Use a disposable local test database')
const {prisma}=await import('../lib/prisma.js')
const {analyticsReport,rawReportRows}=await import('../lib/services/reports.js')
const {reportOptions}=await import('../lib/report-options.js')
const {analyticsCsv}=await import('../lib/report-csv.js')
const {analyticsPdf}=await import('../lib/report-pdf.js')
const DAY=86400000,now=new Date(),today=new Date(now.toISOString().slice(0,10)),start=new Date(+today-179*DAY).toISOString().slice(0,10)
const mode=process.argv[2],uid=process.argv[3]||`benchmark-${randomUUID()}`
if(mode){
 const options=reportOptions(new URLSearchParams({traffic:'all',start:mode==='raw'?today.toISOString().slice(0,10):start,end:today.toISOString().slice(0,10)}),now)
 const begin=performance.now()
 const output=mode==='raw'?analyticsCsv('raw',null,await rawReportRows(uid,options)):mode==='pdf'?await analyticsPdf(await analyticsReport(uid,options)):analyticsCsv('dimensions',await analyticsReport(uid,options))
 const elapsed=performance.now()-begin,bytes=typeof output==='string'?Buffer.byteLength(output):output.length
 if(mode==='pdf'){await mkdir('.test-data',{recursive:true});await writeFile('.test-data/export-report.pdf',output)}
 console.log(JSON.stringify({mode,durationMs:Math.round(elapsed),responseBytes:bytes,peakProcessRssMiB:Math.round(process.resourceUsage().maxRSS/1024)}))
 await prisma.$disconnect()
}else{
 try{
  await prisma.user.create({data:{id:uid}})
  const codes=Array.from({length:10},()=>`bench-${randomUUID().slice(0,12)}`)
  await prisma.url.createMany({data:codes.map(shortCode=>({shortCode,userId:uid,originalUrl:'https://example.com/report?private=omitted'}))})
  const daily=[],dims=[]
  for(const [index,linkId] of codes.entries())for(let day=0;day<180;day++){
   const date=new Date(+today-day*DAY),humanClicks=index===0&&day===0?8000:80,botClicks=index===0&&day===0?2000:20,totalClicks=humanClicks+botClicks
   daily.push({linkId,date,humanClicks,botClicks,totalClicks})
   for(const [dimensionType,dimensionValue] of [['country','IN'],['device','desktop'],['browser','Chrome'],['operatingSystem','Windows'],['referrerDomain','example.org']])dims.push({linkId,date,dimensionType,dimensionValue,humanClicks,botClicks,totalClicks})
  }
  for(let i=0;i<daily.length;i+=500)await prisma.linkDailyStats.createMany({data:daily.slice(i,i+500)})
  for(let i=0;i<dims.length;i+=500)await prisma.linkDailyDimension.createMany({data:dims.slice(i,i+500)})
  for(let i=0;i<10000;i+=500)await prisma.clickEvent.createMany({data:Array.from({length:500},(_,j)=>({eventId:randomUUID(),linkId:codes[0],clickedAt:new Date(+today+i+j),country:'IN',device:'desktop',browser:'Chrome',operatingSystem:'Windows',referrerDomain:'example.org',isBot:(i+j)%5===0}))})
  const results=['aggregate','raw','pdf'].map(mode=>JSON.parse(execFileSync(process.execPath,[process.argv[1],mode,uid],{encoding:'utf8',env:process.env})))
  await mkdir('.test-data',{recursive:true});await writeFile('.test-data/export-benchmark.json',JSON.stringify({fixture:'10 links, 180 days, 1800 daily rows, 9000 dimension rows, 10000 raw events; synthetic data in real PostgreSQL',results},null,2));console.log(JSON.stringify(results,null,2))
 }finally{
  await prisma.clickEvent.deleteMany({where:{link:{userId:uid}}});await prisma.linkDailyDimension.deleteMany({where:{link:{userId:uid}}});await prisma.linkDailyStats.deleteMany({where:{link:{userId:uid}}});await prisma.url.deleteMany({where:{userId:uid}});await prisma.user.deleteMany({where:{id:uid}});await prisma.$disconnect()
 }
}
