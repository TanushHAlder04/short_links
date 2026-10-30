export default function TrafficFilter({ value, onChange }) {
  return (
    <label>
      Traffic{' '}
      <select
        aria-label="Traffic"
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="human">Human traffic</option>
        <option value="all">All traffic</option>
        <option value="bot">Bot traffic</option>
      </select>
    </label>
  )
}
