package care

import (
	"testing"
	"time"
)

func TestCalculateUsesPerPlantIntervalsAndSeason(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, time.March, 20, 9, 0, 0, 0, loc)
	summer, winter := 14, 45
	got := Calculate(PlantSchedule{CareStart: start, WaterDays: 7, SummerFeedDays: &summer, WinterFeedDays: &winter}, start, loc)
	if len(got) != 2 || got[1].Season != "winter" || got[1].IntervalDays != 45 || !got[0].DueAt.Equal(start.AddDate(0, 0, 7)) {
		t.Fatalf("unexpected due list: %#v", got)
	}
}

func TestSeasonBoundaries(t *testing.T) {
	for _, tc := range []struct {
		date string
		want string
	}{{"2026-03-31", "winter"}, {"2026-04-01", "summer"}, {"2026-09-30", "summer"}, {"2026-10-01", "winter"}} {
		d, _ := time.Parse("2006-01-02", tc.date)
		if got := Season(d); got != tc.want {
			t.Errorf("%s: got %s want %s", tc.date, got, tc.want)
		}
	}
}

func TestPausedFertilizingAndDST(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, time.March, 7, 9, 0, 0, 0, loc)
	interval := 7
	got := Calculate(PlantSchedule{CareStart: start, WaterDays: interval, SummerFeedDays: &interval, WinterFeedPaused: true}, start, loc)
	if len(got) != 1 || got[0].DueAt.Hour() != 9 || got[0].DueAt.Day() != 14 {
		t.Fatalf("DST date drift: %#v", got)
	}
}

func TestSeasonSwitchRecalculatesFromSameAnchor(t *testing.T) {
	loc := time.UTC
	anchor := time.Date(2026, time.March, 25, 12, 0, 0, 0, loc)
	summer, winter := 10, 40
	got := Calculate(PlantSchedule{CareStart: anchor, WaterDays: 7, SummerFeedDays: &summer, WinterFeedDays: &winter}, time.Date(2026, time.April, 2, 12, 0, 0, 0, loc), loc)
	if len(got) != 2 || got[1].Season != "summer" || got[1].IntervalDays != 10 || got[1].DueAt.Day() != 4 {
		t.Fatalf("season change did not recalculate from anchor: %#v", got)
	}
}

func TestPerPlantIntervalsLateCompletionAndUnpause(t *testing.T) {
	loc := time.UTC
	anchor := time.Date(2026, time.June, 1, 10, 0, 0, 0, loc)
	now := anchor.AddDate(0, 0, 30)
	summer := 12
	first := Calculate(PlantSchedule{CareStart: anchor, WaterDays: 7, SummerFeedDays: &summer}, now, loc)
	second := Calculate(PlantSchedule{CareStart: anchor, WaterDays: 14, SummerFeedDays: &summer}, now, loc)
	if first[0].DueAt.Equal(second[0].DueAt) || !first[0].Overdue || len(first) != 2 {
		t.Fatalf("individual or late schedule result: %#v %#v", first, second)
	}
	paused := Calculate(PlantSchedule{CareStart: anchor, WaterDays: 7, SummerFeedDays: &summer, SummerFeedPaused: true}, now, loc)
	if len(paused) != 1 {
		t.Fatalf("paused summer fertilizing still due: %#v", paused)
	}
	resumed := Calculate(PlantSchedule{CareStart: anchor, WaterDays: 7, SummerFeedDays: &summer}, now, loc)
	if len(resumed) != 2 || !resumed[1].Overdue {
		t.Fatalf("unpause did not restore anchored overdue date: %#v", resumed)
	}
}
