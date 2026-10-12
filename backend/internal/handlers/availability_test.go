package handlers

import (
	"slices"
	"testing"
	"time"

	"pinkstarsociety/internal/models"
)

func TestFirstOpenDay(t *testing.T) {
	const o, b = "open", "blocked"
	day := func(n int, h08, h10, h14, h17 string) models.DayAvailability {
		return models.DayAvailability{Day: n, H08: h08, H10: h10, H14: h14, H17: h17}
	}
	month := func(m int, days ...models.DayAvailability) models.MonthAvailability {
		return models.MonthAvailability{Year: 2026, Month: m, Published: true, Days: days}
	}
	// Lundi 12 octobre 2026, 15h.
	now := time.Date(2026, 10, 12, 15, 0, 0, 0, time.UTC)

	tests := []struct {
		name      string
		month     models.MonthAvailability
		wantDate  string // vide = aucun jour libre
		wantSlots []string
	}{
		{
			name:      "jours passés ignorés",
			month:     month(10, day(11, o, o, o, o), day(12, b, b, b, b), day(13, b, o, b, o)),
			wantDate:  "2026-10-13",
			wantSlots: []string{"h10", "h17"},
		},
		{
			name:      "aujourd'hui : créneaux déjà commencés ignorés",
			month:     month(10, day(12, o, o, o, o)),
			wantDate:  "2026-10-12",
			wantSlots: []string{"h17"},
		},
		{
			name:      "aujourd'hui sans créneau à venir → lendemain",
			month:     month(10, day(12, o, o, o, b), day(13, o, b, b, b)),
			wantDate:  "2026-10-13",
			wantSlots: []string{"h08"},
		},
		{
			name:      "jours dans le désordre",
			month:     month(10, day(20, o, b, b, b), day(14, b, b, o, b)),
			wantDate:  "2026-10-14",
			wantSlots: []string{"h14"},
		},
		{
			name:      "mois suivant",
			month:     month(11, day(1, b, b, b, b), day(2, b, o, b, b)),
			wantDate:  "2026-11-02",
			wantSlots: []string{"h10"},
		},
		{
			name:  "complet",
			month: month(10, day(12, o, o, o, b), day(13, b, b, b, b)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := firstOpenDay(tt.month, now)
			if tt.wantDate == "" {
				if ok {
					t.Fatalf("aucun jour libre attendu, obtenu %+v", got)
				}
				return
			}
			if !ok || got.Date != tt.wantDate || !slices.Equal(got.Slots, tt.wantSlots) {
				t.Fatalf("obtenu %+v (ok=%v), attendu %s %v", got, ok, tt.wantDate, tt.wantSlots)
			}
		})
	}
}
