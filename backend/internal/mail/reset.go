package mail

import (
	"bytes"
	"html/template"
	"strings"

	"pinkstarsociety/internal/config"
)

type resetMailData struct {
	ResetURL string
}

var resetHTMLTmpl = template.Must(template.New("reset").Parse(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisation du mot de passe</title>
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
                Mot de passe<br/><span style="background:linear-gradient(90deg,#fff,#ff8ecf,#ff2bb1);-webkit-background-clip:text;background-clip:text;color:transparent;">oublié ?</span>
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">
                Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour en choisir un nouveau.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <div style="text-align:center;margin:8px 0 20px;">
                <a href="{{.ResetURL}}" style="display:inline-block;padding:14px 32px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#fff;background:linear-gradient(180deg,#ff5cb6 0%,#ff007a 50%,#b00056 100%);box-shadow:0 0 24px rgba(255,0,122,0.45),0 8px 24px rgba(0,0,0,0.4);">
                  Modifier mon mot de passe
                </a>
              </div>
              <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.38);text-align:center;">
                Ce lien expire dans 1 heure. Si tu n&apos;as pas fait cette demande, ignore cet e-mail.
              </p>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.30);text-align:center;word-break:break-all;">
                Lien direct : <a href="{{.ResetURL}}" style="color:rgba(255,43,177,0.8);">{{.ResetURL}}</a>
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

func SendPasswordReset(cfg *config.Config, to, token string) error {
	if cfg.SMTPHost == "" || cfg.EmailFrom == "" || to == "" {
		return nil
	}
	resetURL := strings.TrimRight(cfg.FrontendURL, "/") + "/reinitialiser-mot-de-passe?token=" + token
	data := resetMailData{ResetURL: resetURL}

	var htmlBuf bytes.Buffer
	if err := resetHTMLTmpl.Execute(&htmlBuf, data); err != nil {
		return err
	}

	plain := "Bonjour,\n\nTu as demandé à réinitialiser ton mot de passe Pink Star Society.\n\n" +
		"Clique sur ce lien pour en choisir un nouveau (valide 1 heure) :\n" +
		resetURL + "\n\nSi tu n'as pas fait cette demande, ignore cet e-mail.\n\n— Pink Star Society\n"

	msg, err := buildMultipartMessage(cfg.EmailFrom, to, "Pink Star Society — Réinitialisation du mot de passe", plain, htmlBuf.String())
	if err != nil {
		return err
	}
	return SendMessage(cfg, cfg.EmailFrom, to, msg)
}
