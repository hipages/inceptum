import { GraphQLScalarType, GraphQLError } from 'graphql';
export const fakeDatabase = {
  mockJobAssignmentData: [
    {
      id: 1,
      hired: false,
      assignedTradieId: 4,
    },
    {
      id: 2,
      hired: true,
      assignedTradieId: 3,
    },
  ],
  mockTradieData: [
    {
      id: 4,
      name: 'tian cai4',
      email: 'wdakdjasld@gmail.com',
      mobileNumber: '9999',
    },
    {
      id: 3,
      name: 'tian cai3',
      email: 'wdakdjasld@gmail.com',
      mobileNumber: '9999',
    },
    {
      id: 2,
      name: 'tian cai2',
      email: 'wdakdjasld@gmail.com',
      mobileNumber: '9999',
    },
    {
      id: 1,
      name: 'tian cai1',
      email: 'wdakdjasld@gmail.com',
      mobileNumber: '9999',
    },
  ],
  mockJobData: [
    {
      id: 1,
      postCode: '2001',
      category: 'random category 1',
      description: 'something here',
      email: '1@hipages.com.au',
      customerName: 'god 1',
      mobileNumber: '9999999999',
      status: 'NEW',
    },
    {
      id: 2,
      postCode: '2002',
      category: 'random category 2',
      description: 'something here 2',
      email: '2@hipages.com.au',
      customerName: 'god 2',
      mobileNumber: '9999999999',
      status: 'ASSIGNED',
    },
    {
      id: 3,
      postCode: '2003',
      category: 'random category 3',
      description: 'something here',
      email: '3@hipages.com.au',
      customerName: 'god 3',
      mobileNumber: '9999999999',
      status: 'HIRED',
    },
  ],
};


const tradieResolver = {
  RootQuery: {
    tradie: (obj, args, context) => fakeDatabase.mockTradieData.filter((item) => args.id === item.id),
    alltradie: () => fakeDatabase.mockTradieData,
  },
  Mutation: {},
};

const jobAssignmentResolver = {
  RootQuery: {
    jobassignment: (obj, args, context) => fakeDatabase.mockJobAssignmentData.filter((item) => args.id === item.id),
    alljobAssignment: () => fakeDatabase.mockJobAssignmentData,
  },
  Mutation: {},
};
const jobResolver = {
  RootQuery: {
    job: (obj, args, context) => fakeDatabase.mockJobData.filter((item) => {
      if (args.id === item.id) {
        return item;
      }
    }),
    alljobs: () => fakeDatabase.mockJobData,
  },
  Mutation: {},
};

export { tradieResolver, jobResolver, jobAssignmentResolver };
