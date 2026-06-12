package mail

import (
	"bytes"
	"fmt"
	"html/template"
	"mime"
	"mime/multipart"
	"net/textproto"
	"strings"

	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/models"
)

type recapMailData struct {
	ServiceTypeName string
	Date            string
	Time            string
	AmountEUR       string
	PayKindFR       string
	StatusFR        string
	Description     string
	ReservationURL  string
	// payKind: full | deposit | balance (pour variantes du message)
	PayKind string
}

var recapHTMLTmpl = template.Must(template.New("recap").Parse(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rendez-vous confirmé</title>
</head>
<body style="margin:0;padding:0;background:#08080c;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#08080c 0%,#12121a 50%,#08080c 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,43,177,0.25);background:#0c0c12;box-shadow:0 24px 64px rgba(0,0,0,0.45),0 0 40px rgba(255,43,177,0.08);">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,rgba(255,43,177,0.18) 0%,transparent 55%);border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Pink Star Society</p>
              {{if eq .PayKind "balance"}}
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fff;line-height:1.2;">
                Totalité<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">réglée</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Le <strong style="color:#fff;">solde</strong> vient d&apos;être payé : ta réservation est maintenant <strong style="color:#fff;">payée intégralement</strong>. Merci pour ta confiance — on a hâte de te voir !
              </p>
              {{else if eq .PayKind "deposit"}}
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fff;line-height:1.2;">
                Acompte<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">reçu</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Ton acompte est bien enregistré. Tu pourras régler le solde quand tu veux depuis ton lien réservation. On a hâte de te voir !
              </p>
              {{else}}
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fff;line-height:1.2;">
                Rendez-vous<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">confirmé</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Merci pour ta confiance — ton paiement est bien enregistré. On a hâte de te voir !
              </p>
              {{end}}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Récapitulatif</p>
                    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fff;">{{.ServiceTypeName}}</p>
                    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);">
                      <span style="color:#ff2bb1;">●</span> {{.Date}} &nbsp;·&nbsp; {{.Time}}
                    </p>
                    <table role="presentation" width="100%" style="font-size:14px;color:rgba(255,255,255,0.78);">
                      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.45);">Montant payé</td><td align="right" style="padding:6px 0;font-weight:600;color:#fff;">{{.AmountEUR}} €</td></tr>
                      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.45);">Type de paiement</td><td align="right" style="padding:6px 0;">{{.PayKindFR}}</td></tr>
                      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.45);">Statut</td><td align="right" style="padding:6px 0;">{{.StatusFR}}</td></tr>
                    </table>
                    {{if .Description}}
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);">
                      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Note</p>
                      <p style="margin:0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.75);white-space:pre-line;">{{.Description}}</p>
                    </div>
                    {{end}}
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="{{.ReservationURL}}" style="display:inline-block;padding:14px 32px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:linear-gradient(180deg,#ff5cb6 0%,#ff007a 50%,#b00056 100%);box-shadow:0 0 24px rgba(255,0,122,0.45),0 8px 24px rgba(0,0,0,0.4);">
                  Voir ma réservation
                </a>
              </div>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.38);text-align:center;">
                Facture PDF &amp; ajout agenda depuis cette page.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 26px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);text-align:center;">
                Pink Star Society — message automatique, merci de ne pas répondre directement à cet e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`))

func recapSubject(payKind string) string {
	switch payKind {
	case "balance":
		return "Pink Star Society — Totalité réglée"
	case "deposit":
		return "Pink Star Society — Acompte reçu"
	default:
		return "Pink Star Society — Rendez-vous confirmé"
	}
}

// SendPaymentRecap envoie la confirmation (HTML + texte brut) au client après
// chaque paiement Stripe réussi.
func SendPaymentRecap(cfg *config.Config, to string, b models.Booking, payKind string, amountCents int64) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" {
		return nil
	}
	subject := recapSubject(payKind)
	payFr := paymentKindFR(payKind)
	amount := float64(amountCents) / 100
	amountStr := fmt.Sprintf("%.2f", amount)
	desc := strings.TrimSpace(b.Description)

	resURL := strings.TrimRight(cfg.FrontendURL, "/") + "/reservation/" + b.PublicToken

	data := recapMailData{
		ServiceTypeName: b.ServiceTypeName,
		Date:            b.Date,
		Time:            b.Time,
		AmountEUR:       amountStr,
		PayKindFR:       payFr,
		StatusFR:        paymentStatusFR(b.PaymentStatus),
		Description:     desc,
		ReservationURL:  resURL,
		PayKind:         payKind,
	}

	var htmlBuf bytes.Buffer
	if err := recapHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}

	plain := plainRecapBody(b, payKind, payFr, amount, desc, resURL)
	msg, err := buildMultipartMessage(cfg.EmailFrom, to, subject, plain, htmlBuf.String())
	if err != nil {
		return err
	}
	return SendMessage(cfg, cfg.EmailFrom, to, msg)
}

func plainRecapBody(b models.Booking, payKind, payFr string, amount float64, desc, resURL string) string {
	var sb strings.Builder
	sb.WriteString("Bonjour,\n\n")
	switch payKind {
	case "balance":
		sb.WriteString("Le solde vient d'être réglé : ta réservation est maintenant payée intégralement.\n\n")
	case "deposit":
		sb.WriteString("Ton acompte pour ton rendez-vous Pink Star Society est bien enregistré.\n\n")
	default:
		sb.WriteString("Ton rendez-vous Pink Star Society est confirmé.\n\n")
	}
	sb.WriteString("Récapitulatif\n")
	sb.WriteString("— Prestation : ")
	sb.WriteString(b.ServiceTypeName)
	sb.WriteString("\n— Date : ")
	sb.WriteString(b.Date)
	sb.WriteString(" à ")
	sb.WriteString(b.Time)
	sb.WriteString("\n— Montant payé : ")
	sb.WriteString(fmt.Sprintf("%.2f", amount))
	sb.WriteString(" € (")
	sb.WriteString(payFr)
	sb.WriteString(")\n— Statut : ")
	sb.WriteString(paymentStatusFR(b.PaymentStatus))
	sb.WriteString("\n")
	if desc != "" {
		sb.WriteString("— Note : ")
		sb.WriteString(desc)
		sb.WriteString("\n")
	}
	sb.WriteString("\nLien réservation : ")
	sb.WriteString(resURL)
	sb.WriteString("\n\n— Pink Star Society\n")
	return sb.String()
}


// buildMultipartMessage construit un message multipart/alternative conforme (évite l’affichage HTML en brut).
func buildMultipartMessage(from, to, subject, plain, html string) ([]byte, error) {
	encSub := mime.QEncoding.Encode("utf-8", subject)

	var mimeBody bytes.Buffer
	mp := multipart.NewWriter(&mimeBody)
	boundary := mp.Boundary()

	hPlain := textproto.MIMEHeader{}
	hPlain.Set("Content-Type", "text/plain; charset=UTF-8")
	hPlain.Set("Content-Transfer-Encoding", "8bit")
	wPlain, err := mp.CreatePart(hPlain)
	if err != nil {
		return nil, err
	}
	if _, err = wPlain.Write([]byte(normalizeCRLF(plain))); err != nil {
		return nil, err
	}

	hHTML := textproto.MIMEHeader{}
	hHTML.Set("Content-Type", "text/html; charset=UTF-8")
	hHTML.Set("Content-Transfer-Encoding", "8bit")
	wHTML, err := mp.CreatePart(hHTML)
	if err != nil {
		return nil, err
	}
	if _, err = wHTML.Write([]byte(normalizeCRLF(html))); err != nil {
		return nil, err
	}
	if err = mp.Close(); err != nil {
		return nil, err
	}

	var out bytes.Buffer
	fmt.Fprintf(&out, "From: %s\r\n", from)
	fmt.Fprintf(&out, "To: %s\r\n", to)
	fmt.Fprintf(&out, "Subject: %s\r\n", encSub)
	fmt.Fprintf(&out, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&out, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", boundary)
	_, err = out.Write(mimeBody.Bytes())
	if err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

type rescheduleMailData struct {
	ServiceTypeName string
	OldDate         string
	OldTime         string
	NewDate         string
	NewTime         string
	NewEndTime      string
	Description     string
	ReservationURL  string
}

var rescheduleHTMLTmpl = template.Must(template.New("reschedule").Parse(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rendez-vous déplacé</title>
</head>
<body style="margin:0;padding:0;background:#08080c;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#08080c 0%,#12121a 50%,#08080c 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,43,177,0.25);background:#0c0c12;box-shadow:0 24px 64px rgba(0,0,0,0.45),0 0 40px rgba(255,43,177,0.08);">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,rgba(255,43,177,0.18) 0%,transparent 55%);border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Pink Star Society</p>
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fff;line-height:1.2;">
                Rendez-vous<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">déplacé</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Ton rendez-vous a été <strong style="color:#fff;">reprogrammé</strong>. Retrouve ci-dessous les nouveaux créneaux.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Nouvelle date</p>
                    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fff;">{{.ServiceTypeName}}</p>
                    <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ff2bb1;">
                      {{.NewDate}} &nbsp;·&nbsp; {{.NewTime}}{{if .NewEndTime}} — {{.NewEndTime}}{{end}}
                    </p>
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);">
                      <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Ancienne date</p>
                      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);text-decoration:line-through;">{{.OldDate}} · {{.OldTime}}</p>
                    </div>
                    {{if .Description}}
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);">
                      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Note</p>
                      <p style="margin:0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.75);white-space:pre-line;">{{.Description}}</p>
                    </div>
                    {{end}}
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="{{.ReservationURL}}" style="display:inline-block;padding:14px 32px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:linear-gradient(180deg,#ff5cb6 0%,#ff007a 50%,#b00056 100%);box-shadow:0 0 24px rgba(255,0,122,0.45),0 8px 24px rgba(0,0,0,0.4);">
                  Voir ma réservation
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 26px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);text-align:center;">
                Pink Star Society — message automatique, merci de ne pas répondre directement à cet e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`))

// SendRescheduleNotification envoie un e-mail de confirmation de déplacement de RDV.
func SendRescheduleNotification(cfg *config.Config, to string, b models.Booking, oldDate, oldTime string) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" {
		return nil
	}
	resURL := strings.TrimRight(cfg.FrontendURL, "/") + "/reservation/" + b.PublicToken
	data := rescheduleMailData{
		ServiceTypeName: b.ServiceTypeName,
		OldDate:         oldDate,
		OldTime:         oldTime,
		NewDate:         b.Date,
		NewTime:         b.Time,
		NewEndTime:      strings.TrimSpace(b.EndTime),
		Description:     strings.TrimSpace(b.Description),
		ReservationURL:  resURL,
	}
	var htmlBuf bytes.Buffer
	if err := rescheduleHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}
	plain := plainRescheduleBody(data)
	subject := mime.QEncoding.Encode("utf-8", "Pink Star Society — Rendez-vous déplacé")

	var mimeBody bytes.Buffer
	mp := multipart.NewWriter(&mimeBody)
	boundary := mp.Boundary()

	hPlain := textproto.MIMEHeader{}
	hPlain.Set("Content-Type", "text/plain; charset=UTF-8")
	hPlain.Set("Content-Transfer-Encoding", "8bit")
	wPlain, err := mp.CreatePart(hPlain)
	if err != nil {
		return err
	}
	if _, err = wPlain.Write([]byte(normalizeCRLF(plain))); err != nil {
		return err
	}
	hHTML := textproto.MIMEHeader{}
	hHTML.Set("Content-Type", "text/html; charset=UTF-8")
	hHTML.Set("Content-Transfer-Encoding", "8bit")
	wHTML, err := mp.CreatePart(hHTML)
	if err != nil {
		return err
	}
	if _, err = wHTML.Write([]byte(normalizeCRLF(htmlBuf.String()))); err != nil {
		return err
	}
	if err = mp.Close(); err != nil {
		return err
	}

	var out bytes.Buffer
	fmt.Fprintf(&out, "From: %s\r\n", cfg.EmailFrom)
	fmt.Fprintf(&out, "To: %s\r\n", to)
	fmt.Fprintf(&out, "Subject: %s\r\n", subject)
	fmt.Fprintf(&out, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&out, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", boundary)
	if _, err = out.Write(mimeBody.Bytes()); err != nil {
		return err
	}
	return SendMessage(cfg, cfg.EmailFrom, to, out.Bytes())
}

func plainRescheduleBody(d rescheduleMailData) string {
	var sb strings.Builder
	sb.WriteString("Bonjour,\n\n")
	sb.WriteString("Ton rendez-vous Pink Star Society a été reprogrammé.\n\n")
	sb.WriteString("Nouvelle date\n")
	sb.WriteString("— Prestation : ")
	sb.WriteString(d.ServiceTypeName)
	sb.WriteString("\n— Nouvelle date : ")
	sb.WriteString(d.NewDate)
	sb.WriteString(" à ")
	sb.WriteString(d.NewTime)
	if d.NewEndTime != "" {
		sb.WriteString(" — ")
		sb.WriteString(d.NewEndTime)
	}
	sb.WriteString("\n— Ancienne date : ")
	sb.WriteString(d.OldDate)
	sb.WriteString(" à ")
	sb.WriteString(d.OldTime)
	sb.WriteString("\n")
	if d.Description != "" {
		sb.WriteString("— Note : ")
		sb.WriteString(d.Description)
		sb.WriteString("\n")
	}
	sb.WriteString("\nLien réservation : ")
	sb.WriteString(d.ReservationURL)
	sb.WriteString("\n\n— Pink Star Society\n")
	return sb.String()
}

func normalizeCRLF(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.ReplaceAll(s, "\n", "\r\n")
}

func paymentKindFR(k string) string {
	switch k {
	case "full":
		return "Paiement total"
	case "deposit":
		return "Acompte"
	case "balance":
		return "Solde"
	default:
		return k
	}
}

func paymentStatusFR(s string) string {
	switch s {
	case "paid":
		return "Payé intégralement"
	case "deposit_paid":
		return "Acompte payé"
	default:
		return s
	}
}

// ── Email de remerciement + demande d'avis Google ────────────────────────────

type reviewMailData struct {
	ClientFirstName string
	ServiceTypeName string
	Date            string
	GoogleReviewURL string
}

var reviewHTMLTmpl = template.Must(template.New("review").Parse(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Merci pour ta visite ✨</title>
</head>
<body style="margin:0;padding:0;background:#08080c;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#08080c 0%,#12121a 50%,#08080c 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,43,177,0.25);background:#0c0c12;box-shadow:0 24px 64px rgba(0,0,0,0.45),0 0 40px rgba(255,43,177,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,rgba(255,43,177,0.18) 0%,transparent 55%);border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Pink Star Society</p>
              <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#fff;line-height:1.2;">
                Merci pour<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">ta visite ✨</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.72);">
                {{if .ClientFirstName}}Merci <strong style="color:#fff;">{{.ClientFirstName}}</strong> — c{{else}}C{{end}}'était un plaisir de te recevoir pour ton <strong style="color:#fff;">{{.ServiceTypeName}}</strong>. On espère que tu repartiras avec le sourire !
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:22px 24px;">
                    <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Ta prestation du {{.Date}}</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#fff;">{{.ServiceTypeName}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Google Review -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.65);">
                Ton avis compte énormément pour nous. Si tu as passé un bon moment, laisse-nous quelques mots sur Google — c'est rapide et ça nous aide beaucoup 🌟
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;text-align:center;">
              {{if .GoogleReviewURL}}
              <a href="{{.GoogleReviewURL}}"
                 style="display:inline-block;padding:16px 36px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:linear-gradient(180deg,#ff5cb6 0%,#ff007a 50%,#b00056 100%);box-shadow:0 0 28px rgba(255,0,122,0.50),0 8px 24px rgba(0,0,0,0.4);">
                ⭐ Laisser un avis Google
              </a>
              <p style="margin:14px 0 0;font-size:11px;color:rgba(255,255,255,0.35);">
                Ou copie ce lien : <a href="{{.GoogleReviewURL}}" style="color:rgba(255,43,177,0.8);word-break:break-all;">{{.GoogleReviewURL}}</a>
              </p>
              {{end}}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 26px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);text-align:center;">
                Pink Star Society — message automatique, merci de ne pas répondre directement à cet e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`))

// SendReviewRequest envoie un e-mail de remerciement avec un lien direct vers l'avis Google.
func SendReviewRequest(cfg *config.Config, to string, b models.Booking, clientFirstName string) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" {
		return nil
	}
	if cfg.GoogleReviewURL == "" {
		return nil
	}

	data := reviewMailData{
		ClientFirstName: clientFirstName,
		ServiceTypeName: b.ServiceTypeName,
		Date:            b.Date,
		GoogleReviewURL: cfg.GoogleReviewURL,
	}

	var htmlBuf bytes.Buffer
	if err := reviewHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}

	plain := plainReviewBody(data)
	msg, err := buildMultipartMessage(cfg.EmailFrom, to, "Pink Star Society — Merci pour ta visite ✨", plain, htmlBuf.String())
	if err != nil {
		return err
	}
	return SendMessage(cfg, cfg.EmailFrom, to, msg)
}

func plainReviewBody(d reviewMailData) string {
	var sb strings.Builder
	sb.WriteString("Bonjour")
	if d.ClientFirstName != "" {
		sb.WriteString(" ")
		sb.WriteString(d.ClientFirstName)
	}
	sb.WriteString(",\n\n")
	sb.WriteString("Merci pour ta visite chez Pink Star Society pour ton ")
	sb.WriteString(d.ServiceTypeName)
	sb.WriteString(" du ")
	sb.WriteString(d.Date)
	sb.WriteString(".\n\n")
	sb.WriteString("C'était un plaisir de te recevoir ! Si tu as passé un bon moment, laisse-nous un avis Google :\n")
	sb.WriteString(d.GoogleReviewURL)
	sb.WriteString("\n\nÀ très bientôt !\n— Pink Star Society\n")
	return sb.String()
}
