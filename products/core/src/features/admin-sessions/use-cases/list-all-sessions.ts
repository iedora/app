import type {
  AdminSessionRow,
  AdminSessionsGateway,
  ListAllSessionsInput,
} from '../ports'

export async function listAllSessions(
  gateway: AdminSessionsGateway,
  input: ListAllSessionsInput,
): Promise<ReadonlyArray<AdminSessionRow>> {
  return gateway.listAllSessions(input)
}
