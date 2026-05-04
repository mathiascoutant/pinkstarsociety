package pdf

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"pinkstarsociety/internal/models"

	"github.com/jung-kurt/gofpdf"
)

func Invoice(b models.Booking, paymentStatus string) ([]byte, error) {
	p := gofpdf.New("P", "mm", "A4", "")
	p.AddPage()
	p.SetFont("Arial", "B", 18)
	p.CellFormat(0, 10, "Pink Star Society", "", 1, "L", false, 0, "")
	p.SetFont("Arial", "", 11)
	p.Ln(4)
	p.CellFormat(0, 8, "Facture", "", 1, "L", false, 0, "")
	p.Ln(2)
	p.SetFont("Arial", "", 10)
	p.CellFormat(0, 6, fmt.Sprintf("Date: %s", time.Now().Format("02/01/2006")), "", 1, "L", false, 0, "")
	p.CellFormat(0, 6, fmt.Sprintf("Reference: %s", b.PublicToken), "", 1, "L", false, 0, "")
	p.Ln(4)
	p.SetFont("Arial", "B", 11)
	p.CellFormat(60, 8, "Prestation", "1", 0, "L", false, 0, "")
	p.CellFormat(40, 8, "Date RDV", "1", 0, "L", false, 0, "")
	p.CellFormat(30, 8, "Montant", "1", 1, "R", false, 0, "")
	amountLine := b.PriceCents
	if paymentStatus == "deposit_paid" {
		amountLine = b.DepositCents
	}
	p.SetFont("Arial", "", 10)
	p.CellFormat(60, 8, truncate(b.ServiceTypeName, 40), "1", 0, "L", false, 0, "")
	p.CellFormat(40, 8, fmt.Sprintf("%s %s", b.Date, b.Time), "1", 0, "L", false, 0, "")
	p.CellFormat(30, 8, formatEUR(amountLine), "1", 1, "R", false, 0, "")
	if strings.TrimSpace(b.Description) != "" {
		p.Ln(2)
		p.MultiCell(0, 6, "Description: "+b.Description, "", "L", false)
	}
	p.Ln(6)
	p.SetFont("Arial", "B", 10)
	label := "Statut paiement"
	val := paymentStatus
	switch paymentStatus {
	case "paid":
		val = "Regle (totalite)"
	case "deposit_paid":
		val = "Acompte regle"
	}
	p.CellFormat(0, 8, fmt.Sprintf("%s: %s", label, val), "", 1, "L", false, 0, "")
	p.Ln(4)
	p.SetFont("Arial", "I", 9)
	p.MultiCell(0, 5, "Merci pour votre confiance.", "", "L", false)

	var buf bytes.Buffer
	if err := p.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func formatEUR(cents int64) string {
	e := float64(cents) / 100
	return fmt.Sprintf("%.2f EUR", e)
}

func truncate(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max-1]) + "."
}

func BuildICS(b models.Booking) string {
	dateCompact := strings.ReplaceAll(b.Date, "-", "")
	t := strings.TrimSpace(b.Time)
	parts := strings.Split(t, ":")
	hh, mm := "12", "00"
	if len(parts) >= 2 {
		hh, mm = parts[0], parts[1]
	}
	if len(hh) == 1 {
		hh = "0" + hh
	}
	if len(mm) == 1 {
		mm = "0" + mm
	}
	dtStart := dateCompact + "T" + hh + mm + "00"
	stamp := time.Now().UTC().Format("20060102T150405") + "Z"
	desc := strings.ReplaceAll(b.Description, "\n", "\\n")
	desc = strings.ReplaceAll(desc, ",", "\\,")
	return fmt.Sprintf("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Pink Star Society//FR\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:%s@pinkstarsociety\r\nDTSTAMP:%s\r\nDTSTART:%s\r\nSUMMARY:%s\r\nDESCRIPTION:%s\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
		b.PublicToken, stamp, dtStart, escapeICS(b.ServiceTypeName), escapeICS(desc))
}

func escapeICS(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, ";", "\\;")
	s = strings.ReplaceAll(s, ",", "\\,")
	s = strings.ReplaceAll(s, "\n", "\\n")
	return s
}
