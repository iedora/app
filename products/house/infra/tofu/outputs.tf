output "worker_name" {
  description = "Cloudflare Worker name. Mirrors var.worker_name; exposed for dashboard / debug commands."
  value       = var.worker_name
}

output "hostname" {
  description = "Public hostname bound to the worker."
  value       = cloudflare_workers_custom_domain.apex.hostname
}
