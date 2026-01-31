/**
 * Structure Card - Player Anthropometrics
 * Shows height, weight, ape index, and body type classification
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Ruler, Scale } from 'lucide-react';
import { PlayerStructure, BodyType } from '@/lib/lab-report-types';

interface StructureCardProps {
  structure: PlayerStructure;
}

function getBodyTypeColor(bodyType: BodyType): string {
  switch (bodyType) {
    case 'ROTATIONAL': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'LINEAR': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'BALANCED': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

export function StructureCard({ structure }: StructureCardProps) {
  if (!structure.present) return null;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          Your Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Physical Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {structure.height_display && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <Ruler className="h-4 w-4 mx-auto mb-1 text-slate-400" />
              <div className="text-lg font-bold text-white">{structure.height_display}</div>
              <div className="text-xs text-slate-500">Height</div>
            </div>
          )}
          {structure.weight_lbs && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <Scale className="h-4 w-4 mx-auto mb-1 text-slate-400" />
              <div className="text-lg font-bold text-white">{structure.weight_lbs}</div>
              <div className="text-xs text-slate-500">Weight (lbs)</div>
            </div>
          )}
          {structure.ape_index_display && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{structure.ape_index_display}</div>
              <div className="text-xs text-slate-500">Ape Index</div>
            </div>
          )}
        </div>

        {/* Body Type Badge */}
        {structure.body_type && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Body Type:</span>
              <Badge 
                variant="outline" 
                className={`${getBodyTypeColor(structure.body_type)} font-semibold`}
              >
                {structure.body_type}
              </Badge>
            </div>
            
            {/* Explanation */}
            {structure.body_type_explanation && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {structure.body_type_explanation}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
