package bookingtime

import (
	"strconv"
	"strings"

	"pinkstarsociety/internal/models"
)

const DefaultDurationMinutes = 60
const AfternoonStartMinutes = 13 * 60

func parseHM(timeStr string) (int, bool) {
	parts := strings.Split(strings.TrimSpace(timeStr), ":")
	if len(parts) < 2 {
		return 0, false
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

// Range retourne début et fin en minutes depuis minuit (fin exclusive logique overlap).
func Range(timeStr, endTimeStr string) (start, end int, ok bool) {
	start, ok = parseHM(timeStr)
	if !ok {
		return 0, 0, false
	}
	if strings.TrimSpace(endTimeStr) != "" {
		end, ok = parseHM(endTimeStr)
		if !ok {
			return 0, 0, false
		}
	} else {
		end = start + DefaultDurationMinutes
	}
	if end <= start {
		end = start + DefaultDurationMinutes
	}
	return start, end, true
}

// IntervalsOverlap : créneaux adjacents (ex. 13–15 et 15–17) ne chevauchent pas.
func IntervalsOverlap(start1, end1, start2, end2 int) bool {
	return start1 < end2 && start2 < end1
}

func BookingsOverlap(a, b models.Booking) bool {
	if a.Date != b.Date {
		return false
	}
	s1, e1, ok1 := Range(a.Time, a.EndTime)
	s2, e2, ok2 := Range(b.Time, b.EndTime)
	if !ok1 || !ok2 {
		return false
	}
	return IntervalsOverlap(s1, e1, s2, e2)
}

// OverlapsHalfDayWindow : matin < 13h, après-midi ≥ 13h (grille dispo publique).
func OverlapsHalfDayWindow(b models.Booking, slot string) bool {
	s, e, ok := Range(b.Time, b.EndTime)
	if !ok {
		return false
	}
	switch slot {
	case "morning":
		return IntervalsOverlap(s, e, 0, AfternoonStartMinutes)
	case "afternoon":
		return IntervalsOverlap(s, e, AfternoonStartMinutes, 24*60)
	}
	return false
}
