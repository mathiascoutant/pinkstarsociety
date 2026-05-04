package mail

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"

	"pinkstarsociety/internal/config"
)

// SendMessage envoie un message RFC 822 brut (en-têtes + corps). Gère le port 465 (TLS implicite OVH/Zimbra).
func SendMessage(cfg *config.Config, from, to string, msg []byte) error {
	if cfg.SMTPHost == "" || from == "" || to == "" {
		return nil
	}
	if cfg.SMTPUser == "" || cfg.SMTPPassword == "" {
		return fmt.Errorf("SMTP : identifiants manquants")
	}
	addr := net.JoinHostPort(cfg.SMTPHost, cfg.SMTPPort)
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)

	if cfg.SMTPPort == "465" {
		return sendImplicitTLS(addr, cfg.SMTPHost, auth, from, to, msg)
	}
	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

func sendImplicitTLS(addr, host string, auth smtp.Auth, from, to string, msg []byte) error {
	tlsConfig := &tls.Config{ServerName: host}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return err
	}
	defer conn.Close()
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer c.Close()
	if err = c.Auth(auth); err != nil {
		return err
	}
	if err = c.Mail(from); err != nil {
		return err
	}
	if err = c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write(msg); err != nil {
		return err
	}
	return w.Close()
}
