

export interface ConnectionPool<T> {
  getConnection(): Promise<T>,
  end(): void,
}
