const tradie = `
  type Tradie {
    id: Int!
    name: String
    email: String
    mobileNumber: String
  }
`;
const jobAssignment = `
  type JobAssignment {
    id: Int!,
    hired: Boolean,
    assignedTradieId: Int
  }
`;
const job = `
  type Job {
    id: Int!,
    postCode: String,
    category: String,
    description: String,
    email: String,
    customerName: String,
    mobileNumber: String,
    status: String
  }
`;
const RootQuery = `
  # the ! means that every object _must_ have an id
  type RootQuery {
    tradie(id: Int!): [Tradie]
    alltradie: [Tradie]
    job(id: Int!): [Job]
    alljobs: [Job]
    jobassignment(id: Int!): [JobAssignment]
    alljobAssignment: [JobAssignment]
  }
`;

const Mutation = `
  type Mutation {
    createJob(body: String): Job
  }
`;

const SchemaDefinition = `
  # we need to tell the server which types represent the root query
  # and root mutation types. We call them RootQuery and RootMutation by convention.
  schema {
    query: RootQuery
    mutation: Mutation
  }
`;
export { SchemaDefinition, RootQuery, Mutation, tradie, jobAssignment, job };
