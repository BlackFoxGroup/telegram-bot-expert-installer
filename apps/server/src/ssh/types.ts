export interface SshAuth {
  host: string;
  port: number;
  username: string;
  method: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SshClient {
  connect(auth: SshAuth): Promise<void>;
  execute(command: string): Promise<ExecResult>;
  upload(localPath: string, remotePath: string): Promise<void>;
  uploadBuffer(data: Buffer, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  exists(remotePath: string): Promise<boolean>;
  mkdir(remotePath: string): Promise<void>;
  close(): void;
  isConnected(): boolean;
}
