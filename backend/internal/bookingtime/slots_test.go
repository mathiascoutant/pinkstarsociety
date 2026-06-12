package bookingtime

import (
	"testing"

	"pinkstarsociety/internal/models"
)

func TestBookingsOverlap(t *testing.T) {
	mk := func(date, time, end string) models.Booking {
		return models.Booking{Date: date, Time: time, EndTime: end}
	}

	if BookingsOverlap(mk("2026-06-12", "13:00", "15:00"), mk("2026-06-12", "15:00", "17:00")) {
		t.Fatal("13-15 et 15-17 ne doivent pas chevaucher")
	}
	if !BookingsOverlap(mk("2026-06-12", "13:00", "15:00"), mk("2026-06-12", "14:30", "17:00")) {
		t.Fatal("13-15 et 14:30-17 doivent chevaucher")
	}
	if BookingsOverlap(mk("2026-06-12", "09:00", "11:00"), mk("2026-06-12", "13:00", "15:00")) {
		t.Fatal("matin et après-midi adjacents ne doivent pas chevaucher")
	}
	if BookingsOverlap(mk("2026-06-12", "13:00", "15:00"), mk("2026-06-13", "13:00", "15:00")) {
		t.Fatal("dates différentes ne chevauchent pas")
	}
}
