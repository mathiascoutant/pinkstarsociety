package handlers

import (
	"encoding/json"
	"strings"
)

func parseClientQRPayload(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	var m struct {
		QR    string `json:"qr"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal([]byte(s), &m); err == nil {
		if t := strings.TrimSpace(m.QR); t != "" {
			return t
		}
		if t := strings.TrimSpace(m.Token); t != "" {
			return t
		}
	}
	if strings.HasPrefix(strings.ToUpper(s), "PSS:") {
		return strings.TrimSpace(s[4:])
	}
	return s
}
