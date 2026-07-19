package bookingtime

import (
	"strconv"
	"strings"

	"pinkstarsociety/internal/models"
)

const DefaultDurationMinutes = 60

// Fenêtres des 4 créneaux (fin exclusive).
var SlotWindows = map[string][2]int{
	"h08": {8 * 60, 10 * 60},
	"h10": {10 * 60, 14 * 60},
	"h14": {14 * 60, 17 * 60},
	"h17": {17 * 60, 24 * 60},
}

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

// OverlapsSlotWindow : le RDV chevauche-t-il le créneau h08/h10/h14/h17 ?
func OverlapsSlotWindow(b models.Booking, slot string) bool {
	window, ok := SlotWindows[slot]
	if !ok {
		return false
	}
	s, e, ok := Range(b.Time, b.EndTime)
	if !ok {
		return false
	}
	return IntervalsOverlap(s, e, window[0], window[1])
}
