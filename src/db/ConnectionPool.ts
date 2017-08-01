

export interface ConnectionPool<T> {
  getConnection(cb: (err: Error, connection: T) => void): void,
  end(): void,
}
