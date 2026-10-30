import {describe,it,expect} from 'vitest'
import {escapeCsv} from '../lib/csv.js'
import {reportOptions,reportFilename,filterCounts} from '../lib/report-options.js'
import {summarizeReport} from '../lib/services/reports.js'
import {analyticsCsv} from '../lib/report-csv.js'
import {pdfText,destinationDomain,analyticsPdf} from '../lib/report-pdf.js'
import {PDFDocument} from 'pdf-lib'
const now=new Date('2026-09-29T12:00:00Z')
const options=(p={})=>reportOptions(new URLSearchParams(p),now)
it.each(['=1+1','+cmd','-1','@SUM(A1)','  =cmd','\tcmd','\rdata','\n=cmd'])('neutralizes formula cell %j',value=>expect(escapeCsv(value).startsWith('"\'')).toBe(true))
it('escapes delimiters, Unicode, empties and malformed values',()=>{
  expect(escapeCsv('a,"b"\n\rc')).toBe('"a,""b""\n\rc"')
  expect(escapeCsv('\u65e5\u672c')).toBe('"\u65e5\u672c"');expect(escapeCsv(null)).toBe('""');expect(escapeCsv(undefined)).toBe('""')
  expect(escapeCsv({secret:'hidden'})).toBe('"[invalid value]"');expect(escapeCsv('a'.repeat(9000))).toHaveLength(8194)
})
it.each([{start:'2026-02-30'},{start:'2026-09-30'},{start:'2020-01-01'},{traffic:'wrong'},{range:'custom'},{timezone:'Asia/Kolkata'}])('rejects invalid options %j',p=>expect(()=>options(p)).toThrow())
it('uses inclusive UTC dates and strict rolling retention boundary',()=>{
  const o=options({range:'7'});expect(o.days).toBe(7);expect(o.startDate).toBe('2026-09-23');expect(o.end.toISOString()).toBe('2026-09-30T00:00:00.000Z');expect(o.rawAvailable).toBe(true)
  expect(options({start:'2026-07-01'}).rawAvailable).toBe(false)
  expect(options({start:'2026-07-02'}).rawAvailable).toBe(true)
})
it('sanitizes report filenames',()=>expect(reportFilename({...options(),shortCode:'../../evil\r\n"'},'pdf')).toMatch(/^shortlinks-evil-analytics-2026-08-31-2026-09-29.pdf$/))
it.each([['human',2],['bot',1],['all',3]])('shares %s metrics across chart, CSV and PDF data',async(traffic,total)=>{
  const o=options({traffic}),row={date:new Date('2026-09-29'),linkId:'abc123',humanClicks:2,botClicks:1,totalClicks:3}
  const report=summarizeReport([{shortCode:'abc123',originalUrl:'https://example.com?secret=hidden'}],[row],[{...row,dimensionType:'country',dimensionValue:'IN'}],o)
  expect(report.totals.totalClicks).toBe(total);expect(report.days.at(-1).totalClicks).toBe(total);expect(report.breakdowns.country[0].count).toBe(total);expect(report.averageClicksPerDay).toBe(total/30)
  expect(analyticsCsv('daily',report)).toContain(`"${total}"`)
  const pdf=await analyticsPdf(report);expect(new TextDecoder().decode(pdf.slice(0,5))).toBe('%PDF-');expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(5)
})
it('handles empty reports and safe PDF text',async()=>{
  const report=summarizeReport([],[],[],options());expect(report.activeRange).toBeNull();expect(report.totals.totalClicks).toBe(0);expect(analyticsCsv('daily',report)).toContain('"shortCode"')
  expect(destinationDomain('https://user:pass@example.com/path?secret=123')).toBe('example.com');expect(pdfText('line\n<test>\u65e5')).toBe('line <test>?')
  expect((await analyticsPdf(report)).length).toBeGreaterThan(1000)
  expect(filterCounts({humanClicks:5,botClicks:2},'human')).toEqual({humanClicks:5,botClicks:0,totalClicks:5})
})
