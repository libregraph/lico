export type StringObject = {[key: string] : string};
export type ResponseType = {[key: string] : string | null | undefined | boolean};
export type ObjectType = {[key: string] : undefined | null | string | boolean | { [key: string]: string | object | string[] } | (string | null)[] };
export type ModelResponseType = {success: boolean , errors: { http: Error }}
export type MappingType = {
  mapping: string[],
  definitions: { [key: string]: { [key: string]: string } }
}
