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

// BookingChange décrit une modification faite par l'admin sur un rendez-vous :
// le libellé du champ, son ancienne et sa nouvelle valeur (déjà formatées).
type BookingChange struct {
	Label string
	Old   string
	New   string
}

type bookingUpdateMailData struct {
	ServiceTypeName string
	Date            string
	Time            string
	EndTime         string
	Changes         []BookingChange
	ReservationURL  string
}

var bookingUpdateHTMLTmpl = template.Must(template.New("bookingUpdate").Parse(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rendez-vous modifié</title>
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
                Rendez-vous<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">modifié</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Ton rendez-vous a été <strong style="color:#fff;">mis à jour</strong>. Voici ce qui a changé.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Ce qui a changé</p>
                    {{range .Changes}}
                    <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.07);">
                      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);">{{.Label}}</p>
                      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);text-decoration:line-through;white-space:pre-line;">{{.Old}}</p>
                      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#ff2bb1;white-space:pre-line;">{{.New}}</p>
                    </div>
                    {{end}}
                    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Ton rendez-vous</p>
                    <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#fff;">{{.ServiceTypeName}}</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">
                      {{.Date}} &nbsp;·&nbsp; {{.Time}}{{if .EndTime}} — {{.EndTime}}{{end}}
                    </p>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="{{.ReservationURL}}" style="display:inline-block;padding:14px 32px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:linear-gradient(180deg,#ff5cb6 0%,#ff007a 50%,#b00056 100%);box-shadow:0 0 24px rgba(255,0,122,0.45),0 8px 24px rgba(0,0,0,0.4);">
                  Voir ma réservation
                </a>
              </div>
              <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.5);text-align:center;">
                Une question sur ce changement ? Réponds-nous en DM Instagram @pinkstar_society.
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

func plainBookingUpdateBody(d bookingUpdateMailData) string {
	var sb strings.Builder
	sb.WriteString("Bonjour,\n\n")
	sb.WriteString("Ton rendez-vous Pink Star Society a été modifié.\n\n")
	sb.WriteString("Ce qui a changé\n")
	for _, ch := range d.Changes {
		sb.WriteString("— ")
		sb.WriteString(ch.Label)
		sb.WriteString(" : ")
		sb.WriteString(ch.Old)
		sb.WriteString(" → ")
		sb.WriteString(ch.New)
		sb.WriteString("\n")
	}
	sb.WriteString("\nTon rendez-vous\n— Prestation : ")
	sb.WriteString(d.ServiceTypeName)
	sb.WriteString("\n— Date : ")
	sb.WriteString(d.Date)
	sb.WriteString(" à ")
	sb.WriteString(d.Time)
	if d.EndTime != "" {
		sb.WriteString(" — ")
		sb.WriteString(d.EndTime)
	}
	sb.WriteString("\n\nLien réservation : ")
	sb.WriteString(d.ReservationURL)
	sb.WriteString("\n")
	return sb.String()
}

// SendBookingUpdateNotification prévient le client qu'un admin a modifié son
// rendez-vous, en listant chaque champ modifié (ancienne → nouvelle valeur).
func SendBookingUpdateNotification(cfg *config.Config, to string, b models.Booking, changes []BookingChange) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" || len(changes) == 0 {
		return nil
	}
	data := bookingUpdateMailData{
		ServiceTypeName: b.ServiceTypeName,
		Date:            b.Date,
		Time:            strings.TrimSpace(b.Time),
		EndTime:         strings.TrimSpace(b.EndTime),
		Changes:         changes,
		ReservationURL:  strings.TrimRight(cfg.FrontendURL, "/") + "/reservation/" + b.PublicToken,
	}
	var htmlBuf bytes.Buffer
	if err := bookingUpdateHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}
	subject := mime.QEncoding.Encode("utf-8", "Pink Star Society — Rendez-vous modifié")

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
	if _, err = wPlain.Write([]byte(normalizeCRLF(plainBookingUpdateBody(data)))); err != nil {
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
