
export interface PoolConfig {
  /**
   * The hostname of the database you are connecting to. (Default: localhost)
   */
  host: string,

  /**
   * The port number to connect to. (Default: 3306)
   */
  port?: number,


  /**
   * The milliseconds before a timeout occurs during the initial connection to the MySQL server. (Default: 10 seconds)
   */
  connectTimeout?: number,
}

export interface ConfigurationObject<T extends PoolConfig> {
  master?: T,
  slave?: T,
}
