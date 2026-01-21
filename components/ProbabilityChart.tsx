import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DiagnosisProbability } from '../types';

interface ProbabilityChartProps {
  data: DiagnosisProbability[];
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

const ProbabilityChart: React.FC<ProbabilityChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        Diagnostic data initializing...
      </div>
    );
  }

  // Sort data descending
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage).slice(0, 6);

  return (
    <div className="w-full h-64">
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">
        Live Diagnostic Probabilities
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis 
            type="category" 
            dataKey="condition" 
            width={100} 
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}%`, 'Likelihood']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
             {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProbabilityChart;