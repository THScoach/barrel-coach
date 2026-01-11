import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarDays } from "lucide-react";

interface PlayerScheduleTabProps {
  playerId: string;
}

export function PlayerScheduleTab({ playerId }: PlayerScheduleTabProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Schedule
        </h3>
        <Button 
          variant="outline" 
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Event
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md bg-transparent"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center text-slate-200",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-slate-400",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-slate-300 hover:bg-slate-800 rounded-md",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-slate-800 text-white",
                day_outside: "text-slate-600 opacity-50",
                day_disabled: "text-slate-600 opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
            />
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-sm">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No upcoming events scheduled.</p>
              <Button 
                variant="link" 
                className="text-primary mt-2"
              >
                Schedule an event →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
