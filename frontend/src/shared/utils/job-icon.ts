import { Monitor, Server, Bug, Palette, Smartphone, Shield, Database, BarChart3, Briefcase, type LucideIcon } from 'lucide-react';

const keywordMap: [string[], LucideIcon][] = [
  [['frontend', 'ui', 'react', 'vue', 'angular', 'web'], Monitor],
  [['backend', 'api', 'server', 'python', 'java', 'node'], Server],
  [['qa', 'test', 'quality'], Bug],
  [['design', 'ux', 'figma', 'graphic'], Palette],
  [['mobile', 'ios', 'android', 'flutter', 'react native'], Smartphone],
  [['security', 'devops', 'infra', 'cloud'], Shield],
  [['data', 'ml', 'ai', 'machine learning', 'analyst'], BarChart3],
  [['database', 'dba', 'sql'], Database],
];

export function getJobIcon(title: string): LucideIcon {
  const lower = title.toLowerCase();
  for (const [keywords, icon] of keywordMap) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return Briefcase;
}
