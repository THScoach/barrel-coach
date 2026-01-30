import { FourBFrameworkDiagram } from '@/components/diagrams/FourBFrameworkDiagram';

export default function DiagramsPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">4B Framework</h1>
        <p className="text-muted-foreground text-center mb-8">
          The complete hitting diagnostic system
        </p>
        
        <FourBFrameworkDiagram showExport={true} />
      </div>
    </div>
  );
}
