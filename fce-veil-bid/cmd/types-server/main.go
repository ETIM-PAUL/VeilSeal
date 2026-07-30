// Package main provides a standalone entry point for the types-server.
package main

import (
	"log"

	"veilbidding/internal/config"
	"veilbidding/internal/typesserver"
	"veilbidding/pkg/decoder"
	"veilbidding/pkg/types"
)

func main() {
	registry := decoder.NewRegistry()
	types.RegisterDecoders(registry)

	s := typesserver.New(registry)
	log.Fatal(s.ListenAndServe(config.TypesServerPort))
}
