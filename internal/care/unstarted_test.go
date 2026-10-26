package care

import (
	"testing"
	"time"
)

func TestIndependentUnstartedSchedules(t *testing.T) {
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	days := 14
	p := PlantSchedule{WaterDays: 7, SummerFeedDays: &days}
	got := Evaluate(p, now, time.UTC)
	if len(got.Due) != 0 || len(got.NotStarted) != 2 {
		t.Fatalf("unstarted: %#v", got)
	}
	watered := now.AddDate(0, 0, -2)
	p.LastWater = &watered
	got = Evaluate(p, now, time.UTC)
	if len(got.Due) != 1 || got.Due[0].Type != "watering" || !got.Due[0].DueAt.Equal(watered.AddDate(0, 0, 7)) || len(got.NotStarted) != 1 || got.NotStarted[0].Type != "fertilizing" {
		t.Fatalf("independent watering: %#v", got)
	}
	p.LastWater = nil
	p.CareStart = &watered
	got = Evaluate(p, now, time.UTC)
	if len(got.NotStarted) != 0 || len(got.Due) != 2 {
		t.Fatalf("fallback: %#v", got)
	}
	p.CareStart = nil
	p.SummerFeedPaused = true
	got = Evaluate(p, now, time.UTC)
	if len(got.Due) != 0 || len(got.NotStarted) != 1 {
		t.Fatalf("paused: %#v", got)
	}
	p.SummerFeedPaused = false
	p.SummerFeedDays = nil
	if got := Evaluate(p, now, time.UTC); len(got.NotStarted) != 1 {
		t.Fatalf("unconfigured: %#v", got)
	}
	p.WinterFeedDays = &days
	if got := Evaluate(p, now.AddDate(0, 5, 0), time.UTC); len(got.NotStarted) != 2 {
		t.Fatalf("new season: %#v", got)
	}
}
