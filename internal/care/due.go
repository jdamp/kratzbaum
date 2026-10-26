// Package care calculates schedule dates without inventing completion events.
package care

import (
	"time"
)

type PlantSchedule struct {
	CareStart        *time.Time
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

type NotStarted struct {
	Type         string
	IntervalDays int
}

type Evaluation struct {
	Due        []Due
	NotStarted []NotStarted
}

// Calculate returns only dated tasks for calendar consumers.
func Calculate(p PlantSchedule, now time.Time, loc *time.Location) []Due {
	return Evaluate(p, now, loc).Due
}

// Evaluate derives each schedule independently from surviving activity history.
func Evaluate(p PlantSchedule, now time.Time, loc *time.Location) Evaluation {
	now = now.In(loc)
	out := Evaluation{Due: []Due{}, NotStarted: []NotStarted{}}
	add := func(kind string, days int, last *time.Time, season string) {
		if days <= 0 {
			return
		}
		base := last
		if base == nil {
			base = p.CareStart
		}
		if base == nil {
			out.NotStarted = append(out.NotStarted, NotStarted{Type: kind, IntervalDays: days})
			return
		}
		due := base.In(loc).AddDate(0, 0, days)
		out.Due = append(out.Due, Due{Type: kind, DueAt: due, IntervalDays: days, Season: season, Overdue: dateOnly(due, loc).Before(dateOnly(now, loc))})
	}
	add("watering", p.WaterDays, p.LastWater, "")
	season := Season(now)
	interval, paused := p.WinterFeedDays, p.WinterFeedPaused
	if season == "summer" {
		interval, paused = p.SummerFeedDays, p.SummerFeedPaused
	}
	if !paused && interval != nil {
		add("fertilizing", *interval, p.LastFeed, season)
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
