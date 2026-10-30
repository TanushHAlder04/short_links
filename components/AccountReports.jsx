 'use client'
import {useEffect,useState} from 'react'
import ReportControls from './ReportControls'
export default function AccountReports({traffic}) {
  const [range,setRange]=useState({range:'30'}),[report,setReport]=useState(null),[error,setError]=useState(''),[shortCode,setShortCode]=useState(''),[links,setLinks]=useState([])
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/reports/export?'+new URLSearchParams({...range,traffic,format:'json',...(shortCode?{shortCode}:{})}),{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.message||'Could not load report');return data}).then(data=>{setReport(data);setError('');if(!shortCode)setLinks(data.links)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)})
    return ()=>controller.abort()
  },[range,traffic,shortCode])
  return <div><label>Report link <select aria-label="Report link" value={shortCode} onChange={e=>setShortCode(e.target.value)}><option value="">All owned links</option>{links.map(l=><option key={l.shortCode} value={l.shortCode}>{l.shortCode}</option>)}</select></label>
    <ReportControls shortCode={shortCode} traffic={traffic} range={range} onRangeChange={setRange}/>
    <p role="status">{error|| (report ? `Selected report period (${report.options.startDate} to ${report.options.endDate}, UTC): ${report.totals.totalClicks} clicks, ${report.totals.humanClicks} human, ${report.totals.botClicks} bot.`:'Loading report totals...')}</p>
  </div>
}
