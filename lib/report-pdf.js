import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
// Standard PDF fonts keep deployment small. Unsupported glyphs are visible placeholders;
// CSV preserves full Unicode. All text is passed to PDF text APIs, never markup.
export function pdfText(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[^\x20-\x7e\xa0-\xff]/g,'?').slice(0,2048)
}
export function destinationDomain(value) {try{return new URL(value).hostname}catch{return 'Unknown destination'}}
export async function analyticsPdf(report) {
  const doc=await PDFDocument.create(), font=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold)
  const ink=rgb(.12,.16,.25),muted=rgb(.38,.43,.51),accent=rgb(.33,.25,.78),pale=rgb(.94,.95,.98)
  const {options:o,totals:t}=report
  doc.setTitle('ShortLinks Analytics Report');doc.setAuthor('ShortLinks');doc.setCreationDate(new Date(o.generatedAt))
  let page,y
  const fit=(value,size=10,width=490)=>{let str=pdfText(value);while(str.length && font.widthOfTextAtSize(str,size)>width)str=str.slice(0,-1);return str===pdfText(value)?str:str.slice(0,-3)+'...'}
  const text=(value,x,at,size=10,strong=false,color=ink,width=490)=>page.drawText(fit(value,size,width),{x,y:at,size,font:strong?bold:font,color})
  const newPage=()=>{page=doc.addPage([595.28,841.89]);y=752;page.drawRectangle({x:0,y:787,width:596,height:55,color:accent});text('SHORTLINKS  /  ANALYTICS',40,807,12,true,rgb(1,1,1));text(`${o.shortCode||'Account'} | ${o.startDate} to ${o.endDate} | ${o.traffic} | UTC`,40,771,9,false,muted)}
  const room=height=>{if(y-height<55)newPage()}
  const heading=title=>{room(38);text(title,40,y,16,true);y-=28}
  const line=(label,value)=>{room(20);text(label,40,y,10,false,muted,190);text(value,235,y,10,true,ink,310);y-=20}
  newPage();heading('ShortLinks Analytics Report')
  line('Scope',o.shortCode||`All owned links (${report.links.length})`)
  if(o.shortCode){line('Short URL',`${(process.env.NEXT_PUBLIC_HOST||'http://localhost:3000').replace(/\/$/,'')}/${o.shortCode}`);line('Destination domain',destinationDomain(report.links[0]?.originalUrl))}
  line('Date range (inclusive)',`${o.startDate} to ${o.endDate}`);line('Traffic / timezone',`${o.traffic} / UTC`);line('Generated',o.generatedAt.replace('T',' ').replace('Z',' UTC'))
  y-=12;heading('Summary metrics')
  line('Total clicks (selected traffic)',t.totalClicks);line('Human clicks',t.humanClicks);line('Bot clicks',t.botClicks);line('Average clicks / calendar day',report.averageClicksPerDay.toFixed(2));line('Active date range',report.activeRange?`${report.activeRange.start} to ${report.activeRange.end}`:'No clicks in selected period')
  for(const [type,label] of [['country','country'],['device','device'],['browser','browser'],['referrerDomain','referrer']])line(`Top ${label}`,report.breakdowns[type][0]?.name||'No data')
  y-=10;text('Counts reflect the selected traffic filter; excluded traffic is shown as zero.',40,y,9,false,muted);y-=18
  text('Daily buckets and timestamps use UTC. Deleted links are excluded.',40,y,9,false,muted);y-=18
  text('Long labels are shortened; unsupported font characters appear as ?.',40,y,9,false,muted)
  newPage();heading('Clicks over time')
  const top=y,max=Math.max(1,...report.days.map(d=>d.totalClicks)),width=505,height=170
  page.drawRectangle({x:45,y:top-height,width,height,color:pale})
  const x=i=>45+i*width/Math.max(1,report.days.length-1), plotY=n=>top-height+12+n/max*(height-24)
  if(report.days.length===1)page.drawCircle({x:45,y:plotY(report.days[0].totalClicks),size:3,color:accent})
  for(let i=1;i<report.days.length;i++)page.drawLine({start:{x:x(i-1),y:plotY(report.days[i-1].totalClicks)},end:{x:x(i),y:plotY(report.days[i].totalClicks)},thickness:1.5,color:accent})
  text(`Peak ${max===1&&!t.totalClicks?0:max} clicks / day`,50,top-12,9,false,muted);y=top-height-18;text(o.startDate,45,y,9);text(o.endDate,480,y,9);y-=35
  const bars=(title,rows)=>{room(250);heading(title);if(!rows.length){text('No data for this period',40,y,10,false,muted);y-=30;return}const max=Math.max(1,...rows.map(r=>r.count));for(const r of rows.slice(0,8)){text(r.name,40,y,9,false,ink,175);page.drawRectangle({x:225,y:y-2,width:Math.max(1,260*r.count/max),height:11,color:accent});text(r.count,495,y,9,false,ink,55);y-=23}y-=15}
  bars('Human versus bot traffic',[{name:'Human',count:t.humanClicks},{name:'Bot',count:t.botClicks}])
  for(const [type,title] of [['country','Countries'],['device','Devices'],['browser','Browsers'],['operatingSystem','Operating systems'],['referrerDomain','Referrer domains']])bars(`${title} - top 8`,report.breakdowns[type])
  const table=(title,headers,rows,widths)=>{newPage();const tableHead=()=>{heading(title);page.drawRectangle({x:35,y:y-5,width:525,height:22,color:pale});let x=40;headers.forEach((h,i)=>{text(h,x,y+2,9,true,ink,widths[i]-10);x+=widths[i]});y-=25};tableHead();if(!rows.length){text('No data for this period',40,y,10);return}for(const row of rows){if(y<65){newPage();tableHead()}let x=40;row.forEach((v,i)=>{text(v,x,y,9,false,ink,widths[i]-10);x+=widths[i]});y-=18}}
  table('Daily click summary',['UTC date','Human','Bot','Total'],report.days.map(d=>[d.date,d.humanClicks,d.botClicks,d.totalClicks]),[220,100,100,100])
  for(const [type,title] of [['country','Top countries'],['device','Top devices'],['browser','Top browsers'],['operatingSystem','Top operating systems'],['referrerDomain','Top referrers']])table(title+' (up to 50)',['Name','Selected clicks'],report.breakdowns[type].slice(0,50).map(r=>[r.name,r.count]),[400,120])
  const pages=doc.getPages();pages.forEach((p,i)=>{page=p;text(`ShortLinks | ${i+1} / ${pages.length}`,40,28,9,false,muted)})
  return doc.save()
}
