import { BlobServiceClient } from "@azure/storage-blob";

export async function uploadFotoToAzure(fotoBuffer: Buffer, nombreArchivo: string): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(nombreArchivo);

  await blockBlobClient.upload(fotoBuffer, fotoBuffer.length);

  return blockBlobClient.url;
}