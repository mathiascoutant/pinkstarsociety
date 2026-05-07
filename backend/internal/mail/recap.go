package mail

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html/template"
	"mime"
	"mime/multipart"
	"net/textproto"
	"strings"

	qrcode "github.com/skip2/go-qrcode"

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
	// Si vrai, on inclut le QR de présence (mode invité uniquement).
	HasQR bool
	// URL absolue (ou cid:) vers le PNG du QR. Typée `template.URL` pour
	// éviter que html/template ne filtre le scheme `cid:` (sanitization
	// agressive sur les URLs inconnues, qui réécrit en `#ZgotmplZ`).
	QRImageURL template.URL
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
              {{if .HasQR}}
              <div style="margin-top:24px;padding:22px;border-radius:14px;background:rgba(255,43,177,0.08);border:1px solid rgba(255,43,177,0.25);text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#ff8ecf;">QR de présence</p>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:rgba(255,255,255,0.72);">
                  Présente ce QR à ton arrivée. <strong style="color:#fff;">Usage unique</strong> — il sera invalidé après le 1er scan.
                </p>
                <img src="{{.QRImageURL}}" alt="QR de présence" width="220" height="220" style="display:inline-block;border-radius:14px;background:#fff;padding:12px;" />
                <p style="margin:14px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">Si l'image ne s'affiche pas, ouvre le lien : <a href="{{.QRImageURL}}" style="color:#ff8ecf;text-decoration:underline;">afficher mon QR</a></p>
              </div>
              {{end}}
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
// chaque paiement Stripe réussi. Si `guestQRToken` est non vide, on intègre
// le QR de présence en pièce jointe inline (réservé au mode invité).
func SendPaymentRecap(cfg *config.Config, to string, b models.Booking, payKind string, amountCents int64, guestQRToken string) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" {
		return nil
	}
	subject := recapSubject(payKind)
	payFr := paymentKindFR(payKind)
	amount := float64(amountCents) / 100
	amountStr := fmt.Sprintf("%.2f", amount)
	desc := strings.TrimSpace(b.Description)

	resURL := strings.TrimRight(cfg.FrontendURL, "/") + "/reservation/" + b.PublicToken

	hasQR := strings.TrimSpace(guestQRToken) != ""
	qrPublicURL := ""
	var qrPNG []byte
	if hasQR {
		qrPublicURL = strings.TrimRight(cfg.FrontendURL, "/") + "/api/public/bookings/" + b.PublicToken + "/qr.png"
		if png, err := qrcode.Encode("PSS:"+strings.TrimSpace(guestQRToken), qrcode.Medium, 512); err == nil {
			qrPNG = png
		}
	}
	// Image inline (CID) : la plupart des clients mail bloquent les images
	// distantes. On embarque le PNG dans le message pour qu'il s'affiche
	// systématiquement.
	qrSrc := qrPublicURL
	if len(qrPNG) > 0 {
		qrSrc = "cid:qr-presence@pinkstar"
	}
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
		HasQR:           hasQR,
		QRImageURL:      template.URL(qrSrc),
	}

	var htmlBuf bytes.Buffer
	if err := recapHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}

	plain := plainRecapBody(b, payKind, payFr, amount, desc, resURL, guestQRToken, qrPublicURL)
	msg, err := buildRecapMessage(cfg.EmailFrom, to, subject, plain, htmlBuf.String(), qrPNG)
	if err != nil {
		return err
	}
	return SendMessage(cfg, cfg.EmailFrom, to, msg)
}

func plainRecapBody(b models.Booking, payKind, payFr string, amount float64, desc, resURL, guestQRToken, qrImageURL string) string {
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
	if strings.TrimSpace(guestQRToken) != "" {
		sb.WriteString("\nQR de présence (usage unique — à montrer à l'arrivée)\n")
		if qrImageURL != "" {
			sb.WriteString("Affiche-le : ")
			sb.WriteString(qrImageURL)
			sb.WriteString("\n")
		}
		sb.WriteString("Code : PSS:")
		sb.WriteString(guestQRToken)
		sb.WriteString("\n")
	}
	sb.WriteString("\nLien réservation : ")
	sb.WriteString(resURL)
	sb.WriteString("\n\n— Pink Star Society\n")
	return sb.String()
}

// buildRecapMessage construit le mail. Si `qrPNG` est non-nul, on utilise
// la structure recommandée : multipart/alternative > [ text/plain ,
// multipart/related > [ text/html , image inline (CID) ] ]. Cette imbrication
// est mieux supportée par Apple Mail / Gmail / Outlook que l'inverse.
func buildRecapMessage(from, to, subject, plain, html string, qrPNG []byte) ([]byte, error) {
	if len(qrPNG) == 0 {
		return buildMultipartMessage(from, to, subject, plain, html)
	}
	encSub := mime.QEncoding.Encode("utf-8", subject)

	// 1) multipart/related : html + image inline (CID)
	var relBody bytes.Buffer
	rel := multipart.NewWriter(&relBody)
	relBoundary := rel.Boundary()

	hHTML := textproto.MIMEHeader{}
	hHTML.Set("Content-Type", "text/html; charset=UTF-8")
	hHTML.Set("Content-Transfer-Encoding", "8bit")
	wHTML, err := rel.CreatePart(hHTML)
	if err != nil {
		return nil, err
	}
	if _, err = wHTML.Write([]byte(normalizeCRLF(html))); err != nil {
		return nil, err
	}

	hImg := textproto.MIMEHeader{}
	hImg.Set("Content-Type", "image/png; name=\"qr-presence.png\"")
	hImg.Set("Content-Transfer-Encoding", "base64")
	hImg.Set("Content-ID", "<qr-presence@pinkstar>")
	hImg.Set("Content-Disposition", "inline; filename=\"qr-presence.png\"")
	wImg, err := rel.CreatePart(hImg)
	if err != nil {
		return nil, err
	}
	enc := base64.StdEncoding.EncodeToString(qrPNG)
	for i := 0; i < len(enc); i += 76 {
		end := i + 76
		if end > len(enc) {
			end = len(enc)
		}
		if _, err = wImg.Write([]byte(enc[i:end] + "\r\n")); err != nil {
			return nil, err
		}
	}
	if err = rel.Close(); err != nil {
		return nil, err
	}

	// 2) multipart/alternative : texte brut + related (html + image)
	var altBody bytes.Buffer
	alt := multipart.NewWriter(&altBody)
	altBoundary := alt.Boundary()

	hPlain := textproto.MIMEHeader{}
	hPlain.Set("Content-Type", "text/plain; charset=UTF-8")
	hPlain.Set("Content-Transfer-Encoding", "8bit")
	wPlain, err := alt.CreatePart(hPlain)
	if err != nil {
		return nil, err
	}
	if _, err = wPlain.Write([]byte(normalizeCRLF(plain))); err != nil {
		return nil, err
	}

	hRel := textproto.MIMEHeader{}
	hRel.Set("Content-Type", fmt.Sprintf("multipart/related; type=\"text/html\"; boundary=%s", relBoundary))
	wRel, err := alt.CreatePart(hRel)
	if err != nil {
		return nil, err
	}
	if _, err = wRel.Write(relBody.Bytes()); err != nil {
		return nil, err
	}
	if err = alt.Close(); err != nil {
		return nil, err
	}

	var out bytes.Buffer
	fmt.Fprintf(&out, "From: %s\r\n", from)
	fmt.Fprintf(&out, "To: %s\r\n", to)
	fmt.Fprintf(&out, "Subject: %s\r\n", encSub)
	fmt.Fprintf(&out, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&out, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", altBoundary)
	if _, err = out.Write(altBody.Bytes()); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
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
