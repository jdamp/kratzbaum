// Package care calculates schedule dates without inventing completion events.
package care

import (
	"time"
)

type PlantSchedule struct {
	CareStart        time.Time
	WaterDays        int
	SummerFeedDays   *int
	WinterFeedDays   *int
	SummerFeedPaused bool
	WinterFeedPaused bool
	LastWater        *time.Time
	LastFeed         *time.Time
}

type Due struct {
	Type         string    `json:"type"`
	DueAt        time.Time `json:"dueAt"`
	IntervalDays int       `json:"intervalDays"`
	Season       string    `json:"season,omitempty"`
	Overdue      bool      `json:"overdue"`
}

// Calculate returns at most one outstanding task per enabled schedule. The
// active season's interval is evaluated from the current local date.
func Calculate(p PlantSchedule, now time.Time, loc *time.Location) []Due {
	now = now.In(loc)
	out := []Due{}
	waterBase := p.CareStart
	if p.LastWater != nil {
		waterBase = *p.LastWater
	}
	if p.WaterDays > 0 {
		due := waterBase.In(loc).AddDate(0, 0, p.WaterDays)
		out = append(out, Due{Type: "watering", DueAt: due, IntervalDays: p.WaterDays, Overdue: dateOnly(due, loc).Before(dateOnly(now, loc))})
	}
	season := Season(now)
	interval := p.WinterFeedDays
	paused := p.WinterFeedPaused
	if season == "summer" {
		interval = p.SummerFeedDays
		paused = p.SummerFeedPaused
	}
	if !paused {
		feedBase := p.CareStart
		if p.LastFeed != nil {
			feedBase = *p.LastFeed
		}
		if interval != nil && *interval > 0 {
			due := feedBase.In(loc).AddDate(0, 0, *interval)
			out = append(out, Due{Type: "fertilizing", DueAt: due, IntervalDays: *interval, Season: season, Overdue: dateOnly(due, loc).Before(dateOnly(now, loc))})
		}
	}
	return out
}

// Northern hemisphere seasons follow the agreed fixed calendar: April–September
// is summer; October–March is winter.
func Season(t time.Time) string {
	if t.Month() >= time.April && t.Month() <= time.September {
		return "summer"
	}
	return "winter"
}

func dateOnly(t time.Time, loc *time.Location) time.Time {
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, loc)
}
