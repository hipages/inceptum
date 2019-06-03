#Plugins

Inceptum does nothing on its own. Almost everything is done using either using internal plugins of 
by user made custom plugins. 

## Writing your first Plugin
In this guide, we will explore how we can implement a plugin by our selves.

For this example, we will implement a fake logger based on the `console`.
In the real world, you will most likely use a proper logger like Winston or
Bunyan. We do this here only for introducing the concept of Inceptum Plugins. 
We will create two classes, one for doing the actual logging operations and
the other for registering the plugin with Inceptum. 

An inceptum plugin can do a lot of things, but for this example, we will
stick with the bare minimum. 

### The Console Logger
Let's see what we want to do here. The logger would have 4 methods, 
   * `debug`
   * `info`
   * `warn`
   * `error`
   
We will disable certain types of logs based on the initial log-level configuration.
For example, if the log-level is set to `warn`, the logger will spit out warnings and 
errors only, while silently swallowing debug and info logs.

#### Step 1: Write the client
The client code is pretty simple. Let's call our logger, `ConsoLogger`

```js
// ConsoLogger.js
const loglevelMap = {
  debug: ['debug', 'info', 'warn', 'error'],
  info: ['info', 'warn', 'error'],
  warn: ['warn', 'error'],
  error: ['error'],
};

export default class ConsoLogger {
  constructor(config) {
    // The corresponding logger config should define a property called `loglevel`
    this.loglevel = config.loglevel
  }
  
  debug(message) {
    this.printLog('debug', message);
  }
  
  info(message) {
    this.printLog('info', message);
  }
  
  warn(message) {
    this.printLog('warn', message);
  }
  
  error(message) {
    this.printLog('error', message);
  }

  printLog(type, message) {
    // Given the log type, if the loglevel map includes the corresponding type,
    // then we print the log, else just ignore
    if (loglevelMap[this.loglevel].includes(type)) {
      console[type](message); // This calls console.info, console.warn, ... respectively
    }
  }
}
```

#### Step 2: Writing the Plugin
The plugin should do 2 basic things,
1. Read the logger config from the `yaml` config file
2. Register the `ConsoLogger` in the inceptum Context

Once this is done and the Plugin is provided in the app, it can be used from any inceptum module
in the app. 

Now let's start writing the plugin. A plugin must have a `name` property, and can implement
one or both of `willStart` and `didStart` life-cycle hooks. The willStart hook will run before 
the Inceptum App starts, and the DidStart hook will run after the App starts. 
You will most likely use the `willStart` hook to initialize a client or a service
similar to this very example.

```typescript
// ConsoLoggerPlugin.ts
import { BaseApp, Plugin, BaseSingletonDefinition } from 'inceptum';
import ConsoLogger from './ConsoLogger';

export default class ConsoLoggerPlugin implements Plugin {
  name = 'ConsoLoggerPlugin';

  willStart(app: BaseApp) {
    // This means that we will read a config with name `logger` from the config yaml files
    if (!app.hasConfig('logger')) {
      throw new Error('Failed to find logger configs');
    }
    
    // Get the inceptum app context
    const context = app.getContext();

    // Read the logger config
    const config = context.getConfig('logger');

    // Create the `ConsoLogger` client definition
    // The name given here, (i.e. 'ConsoLogger') will be used to get the client from the actual app
    const client = new BaseSingletonDefinition(ConsoLogger, 'MyConsoLogger');
    
    // Declare that the logger config we read above will be passed to the client constructor
    client.constructorParamByValue(config);
    
    // Register the logger client in the inceptum app context
    context.registerSingletons(client);
  }
}
```

Cool, we've written our plugin. Now let's use it in our app. 

#### Step 3: Define the logger configuration
Similar to how we defined the mysql configs in the Getting Started guide,
we need to provide the logger config as well. We only need to provide the
log-level for this example. Let's add the following entry to the `default.yaml` file,

```yaml
logger:
  loglevel: warn
```

#### Step 4. Use the logger client 
```typescript
// index.ts
import { InceptumApp, WebPlugin } from 'inceptum';
import ConsoLoggerPlugin from './ConsoLoggerPlugin';

const app = new InceptumApp();

app.use(
  new WebPlugin(),
  new ConsoLoggerPlugin()
);

app.start()
```

Now we can use this from any inceptum module in our app. Let's use it in a service,

```typescript
// AccountService.ts
import { Autowire } from 'inceptum';
import ConsoLogger from '../ConsoLogger';

export default class AccountService {
  // Here we Autowire the ConsoLogger client
  // based on the name we provided in the Plugin
  @Autowire('MyConsoLogger') logger: ConsoLogger;

  createAccount() {
    this.logger.error("Something went wrong!"); // This will output 'Something went wrong!'
    this.logger.info("Less important info"); // This will not output anything, since we set the log-level to `warn`
  }
}
```

That's it for this guide. Merry Inceptum!
