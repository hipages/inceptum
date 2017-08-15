## Creating a simple rest API


## Config

In this tutorial, we will be using inceptum-swagger to create a TODO API that talks to a mysql database. The starting point for 
any inceptum app is the config file, usually stored in the config directory. You can find out more about how config with TOOD: HERE
but for now, we're just going to use one file: `default.yml`;

```yml
# config/default.yml
app:
  name: My Todo App
```

## Setting up our app

```typescript
// src/index.ts
import Inceptum from 'inceptum';

const app = new Inceptum();
app.start();
```

You should see something like below:

TODO SCREENSHOT

## Swagger And Routing

Setting up the swagge plugin is easy! We just need to import the package and tell our App to use it.
Inceptum Web will set up our express server, and SwaggerPlugin will set up our routing via our swagger file.

```typescript
// srcindex.ts
import Inceptum from 'inceptum';
import WebPlugin from 'inceptum-web';
import SwaggerPlugin from 'inceptum-swagger';

const app = new Inceptum();
app.use(new WebPlugin(), new SwaggerPlugin())
app.start();
```

We now need to set up our swagger file where we will define our routes. This seems pretty long, but most of it is just 
boilerplate 

```yml
#swagger.yml
swagger: "2.0"
info:
  version: "0.0.1"
  title: ToDo sample application
host: localhost:10010
basePath: /
schemes:
  - http
  - https 
consumes:
  - application/json
produces:
  - application/json
paths:
  /todo/{id}:
    x-inceptum-controller: TodoController
    get:
      description: Gets one todo by id
      x-inceptum-operation: get(id)
      parameters:
        type: string
        required: true
        in: path
      responses:
        "200":
          description: Success
          schema:
            type: Object
```

The intersting parts here are the custom attributes we've defind `x-inceptum-controller` and `x-inceptum-operation`.
The attributes are basically defining what method we are going to call on what controller, as well as what paramaters
were are going to pass to that method.

We can now write our controller!

```typescript
// src/controllers/DefaultController.ts
class TodoController {

  async get(key) {
    return res.send({
      id: key,
      done: false
    });
  }

}

```
Now, if you start your app and go to `localhost:10100/todo/1234` in your browser you should receive the following JSON response:

```json
{
  "id": 1234,
  "done: false
}
```

Cool! But static data isn't really useful. Lets add a database!



## Adding a database 

To add a database connection to our app, all we need to do is add the following to our config.yml. Inceptum will automatically 
create add MysqlPlugin() // TODO LINK to our application. It will be registered under the name `mysqlClient` to the IoC container.

```yml
#config.yml
mysql: # Telling inceptum to add a new MysqlPlugin() to our app
  MysqlClient: # IoC name
    master:
      host: localhost
      port: 3306
      user: root
      password:
      database: testDb
      charset: utf8
      connectionLimit: 10
```

You'll notice that we've added a `master` conifg. We can also add a `slave` config that Inceptum will use if we want a read only
transaction, like so:

```yml
mysql:
  mysqlClient: # this is the name of the object that will be exposed in the context
    master:
      host: localhost
      port: 3306
      user: root
      password:
      database: testDb
      charset: utf8
      connectionLimit: 10
    slave:
      host: localhost
      port: 3306
      user: root
      password:
      database: testDb
      charset: utf8
      connectionLimit: 10
```

In this example both connections are pointing to the same place, but in production we can change this to point to a read only replica or user.


## Connecting everything together

To talk to our database, we're going to create a `Service` class.

```typescript
export default class TodoService {

  getTodo(id) {
    // TODO Implement me!
  }

}
```

Here, we're going to tell inceptum that we want access to the mysql client we just set up in the service we just created.
To do this, we define a static property on our class to tell inceptum what dependencies we want to be injected.


```typescript
TodoService.autowire = {
  mysql: 'mysqlClient'
};
```

We can now use the client in our service like below:


```typescript
export default class TodoService {

  async getTodo(id) {
    return this.mysql.runInTransaction(true,  async (client) => {
      const [todo] = client.query(`SELECT * FROM todos WHERE id = ?`, id);
      return todo;
    });
  }
}

TodoService.autowire = {
  mysql: 'mysqlClient'
};
```

Now, we need to wire up our service to our controller, we do this in a similar way to myself

```typescript
// src/controllers/DefaultController.ts
export default class TodoController {

  async get(id) {
    const todo = await this.service.getTodo(id);
    res.send(todo);
  }
}

TodoController.autowire = {
  service: 'TodoService'
};

```