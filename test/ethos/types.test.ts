import { describe, it, expect } from "vitest";
import type {
  Person,
  Student,
  Course,
  Section,
  AcademicPeriod,
  Grade,
  GradeScheme,
  SectionRegistration,
  InstructionalEvent,
  StudentAcademicCredential,
  FinancialAidApplication,
  FinancialAidAward,
  FinancialAidFund,
  AccountingString,
  LedgerActivity,
  Employee,
  Position,
  Job,
} from "../../src/ethos/types/index.js";

describe("EEDM Type Definitions", () => {
  describe("Person (v12)", () => {
    it("should accept a valid person object", () => {
      const person: Person = {
        id: "bfc549d3-1a04-4675-952d-39ef93203bd4",
        names: [
          {
            type: { category: "legal" },
            fullName: "John A. Smith",
            title: "Mr.",
            firstName: "John",
            middleName: "Andrew",
            lastName: "Smith",
            pedigree: "Jr.",
            preference: "preferred",
            professionalAbbreviations: ["Ph.D."],
          },
        ],
        dateOfBirth: "1990-05-15",
        gender: "male",
        credentials: [
          { type: "bannerId", value: "A00012345" },
          { type: "ssn", value: "123-45-6789", startOn: "2010-01-01" },
        ],
        emails: [
          {
            type: { type: "personal" },
            address: "john.smith@example.com",
            preference: "primary",
          },
        ],
        phones: [
          {
            type: { type: "mobile" },
            number: "423-555-1234",
            countryCallingCode: "1",
          },
        ],
        addresses: [
          {
            type: { type: "home" },
            address: {
              addressLines: ["123 Main St"],
              place: {
                country: {
                  code: "USA",
                  locality: "Chattanooga",
                  region: { code: "US-TN", title: "Tennessee" },
                  postalCode: "37421",
                },
              },
            },
          },
        ],
        roles: [
          { role: "student", startOn: "2020-08-15" },
          { role: "employee", startOn: "2022-01-10" },
        ],
        ethnicity: {
          ethnicGroup: { id: "guid-ethnicity" },
          reporting: [{ ethnicCategory: "nonHispanic" }],
        },
        races: [{ race: { id: "guid-race" } }],
        languages: [{ code: "eng", preference: "primary" }],
      };

      expect(person.id).toBe("bfc549d3-1a04-4675-952d-39ef93203bd4");
      expect(person.names).toHaveLength(1);
      expect(person.names[0]?.firstName).toBe("John");
      expect(person.credentials).toHaveLength(2);
      expect(person.emails).toHaveLength(1);
      expect(person.roles).toHaveLength(2);
    });

    it("should accept a minimal person object", () => {
      const person: Person = {
        id: "00000000-0000-0000-0000-000000000000",
        names: [{ type: { category: "legal" }, lastName: "Doe" }],
      };

      expect(person.id).toBeDefined();
      expect(person.names).toHaveLength(1);
    });
  });

  describe("Student (v16)", () => {
    it("should accept a valid student object", () => {
      const student: Student = {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        person: { id: "bfc549d3-1a04-4675-952d-39ef93203bd4" },
        types: [{ type: { id: "guid-student-type" } }],
        residencies: [
          {
            residency: { id: "guid-residency-type" },
            startOn: "2020-08-15",
            administrativePeriod: { id: "guid-period" },
          },
        ],
        levelClassifications: [
          {
            level: { id: "guid-undergrad-level" },
            latestClassification: {
              classification: { id: "guid-sophomore" },
            },
          },
        ],
      };

      expect(student.id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(student.person.id).toBe("bfc549d3-1a04-4675-952d-39ef93203bd4");
      expect(student.levelClassifications).toHaveLength(1);
    });

    it("should accept a minimal student object", () => {
      const student: Student = {
        id: "00000000-0000-0000-0000-000000000000",
        person: { id: "11111111-1111-1111-1111-111111111111" },
      };

      expect(student.person.id).toBeDefined();
    });
  });

  describe("Course (v4)", () => {
    it("should accept a valid course object", () => {
      const course: Course = {
        id: "c1d2e3f4-5678-90ab-cdef-123456789012",
        title: "Introduction to Computer Science",
        description: "A survey course covering fundamental concepts in computing.",
        subject: {
          id: "guid-cs-subject",
          title: "Computer Science",
          abbreviation: "CPSC",
        },
        number: "1100",
        academicLevels: [{ id: "guid-undergrad", title: "Undergraduate" }],
        courseLevels: [{ id: "guid-1000-level", title: "Introductory" }],
        credits: [
          {
            creditCategory: {
              creditType: "institutional",
              detail: { id: "guid-credit-category" },
            },
            measure: "credit",
            minimum: 3,
            maximum: 3,
          },
        ],
        instructionalMethods: [{ id: "guid-lecture", title: "Lecture" }],
        gradeSchemes: [{ id: "guid-letter-grade", title: "Letter Grade" }],
        owningInstitutionUnits: [
          {
            institutionUnit: { id: "guid-cs-dept" },
            ownershipPercentage: 100,
          },
        ],
        schedulingStartOn: "2020-01-01",
      };

      expect(course.title).toBe("Introduction to Computer Science");
      expect(course.subject.abbreviation).toBe("CPSC");
      expect(course.number).toBe("1100");
      expect(course.credits).toHaveLength(1);
      expect(course.credits?.[0]?.minimum).toBe(3);
    });

    it("should accept a minimal course object", () => {
      const course: Course = {
        id: "00000000-0000-0000-0000-000000000000",
        title: "Placeholder",
        subject: { id: "guid-subject" },
        number: "0000",
      };

      expect(course.title).toBe("Placeholder");
    });
  });

  describe("Section (v16)", () => {
    it("should accept a valid section object", () => {
      const section: Section = {
        id: "d1e2f3a4-5678-90ab-cdef-abcdef123456",
        titles: [
          { type: "short", value: "Intro CS - Section 01" },
          { type: "long", value: "Introduction to Computer Science" },
        ],
        descriptions: [{ type: "short", value: "Survey of computing concepts." }],
        startOn: "2024-08-19",
        endOn: "2024-12-13",
        code: "CPSC-1100-01",
        number: "01",
        course: { id: "c1d2e3f4-5678-90ab-cdef-123456789012" },
        academicPeriod: { id: "guid-fall-2024", title: "Fall 2024" },
        site: { id: "guid-main-campus", title: "Main Campus" },
        credits: [
          {
            creditCategory: { creditType: "institutional" },
            measure: "credit",
            minimum: 3,
            maximum: 3,
          },
        ],
        instructionalMethods: [{ id: "guid-lecture", title: "Lecture" }],
        status: { category: "open" },
        maxEnrollment: 30,
        waitlist: { maximum: 10 },
        owningInstitutionUnits: [
          {
            institutionUnit: { id: "guid-cs-dept" },
            ownershipPercentage: 100,
          },
        ],
        censusDates: ["2024-09-05"],
      };

      expect(section.titles).toHaveLength(2);
      expect(section.titles[0]?.value).toBe("Intro CS - Section 01");
      expect(section.startOn).toBe("2024-08-19");
      expect(section.maxEnrollment).toBe(30);
      expect(section.status?.category).toBe("open");
    });

    it("should accept a minimal section object", () => {
      const section: Section = {
        id: "00000000-0000-0000-0000-000000000000",
        titles: [{ value: "Test Section" }],
        startOn: "2024-01-01",
        course: { id: "11111111-1111-1111-1111-111111111111" },
        instructionalMethods: [{ id: "guid-lecture" }],
      };

      expect(section.course.id).toBeDefined();
    });
  });

  describe("AcademicPeriod (v16)", () => {
    it("should accept a valid academic period object", () => {
      const period: AcademicPeriod = {
        id: "e1f2a3b4-5678-90ab-cdef-fedcba987654",
        code: "2024FA",
        title: "Fall 2024",
        description: "Fall semester of the 2024-2025 academic year.",
        startOn: "2024-08-19",
        endOn: "2024-12-13",
        censusDates: ["2024-09-05", "2024-10-15"],
        category: {
          type: "term",
          parent: { id: "guid-academic-year-2024" },
        },
        registration: { status: "open" },
      };

      expect(period.code).toBe("2024FA");
      expect(period.title).toBe("Fall 2024");
      expect(period.startOn).toBe("2024-08-19");
      expect(period.endOn).toBe("2024-12-13");
      expect(period.category.type).toBe("term");
      expect(period.censusDates).toHaveLength(2);
    });

    it("should accept a minimal academic period object", () => {
      const period: AcademicPeriod = {
        id: "00000000-0000-0000-0000-000000000000",
        title: "Test Period",
        startOn: "2024-01-01",
        endOn: "2024-05-15",
        category: { type: "term" },
      };

      expect(period.title).toBe("Test Period");
    });
  });

  describe("Grade (v6)", () => {
    it("should accept a valid grade object", () => {
      const grade: Grade = {
        id: "a1b2c3d4-0000-0000-0000-000000000001",
        scheme: { id: "guid-letter-scheme" },
        grade: { value: "A", description: "Excellent" },
        qualityPoints: 4.0,
        creditsIncluded: true,
        attemptedCreditsIncluded: true,
        completedCreditsIncluded: true,
        priority: 1,
      };

      expect(grade.grade?.value).toBe("A");
      expect(grade.qualityPoints).toBe(4.0);
    });

    it("should accept a minimal grade object", () => {
      const grade: Grade = {
        id: "00000000-0000-0000-0000-000000000000",
        scheme: { id: "guid-scheme" },
      };

      expect(grade.scheme.id).toBeDefined();
    });
  });

  describe("GradeScheme (v6)", () => {
    it("should accept a valid grade scheme object", () => {
      const scheme: GradeScheme = {
        id: "a1b2c3d4-0000-0000-0000-000000000002",
        code: "UG",
        title: "Undergraduate Letter Grades",
        description: "Standard undergraduate grading scheme.",
        academicLevel: { id: "guid-undergrad" },
        startOn: "2000-01-01",
      };

      expect(scheme.code).toBe("UG");
      expect(scheme.title).toBe("Undergraduate Letter Grades");
    });

    it("should accept a minimal grade scheme object", () => {
      const scheme: GradeScheme = {
        id: "00000000-0000-0000-0000-000000000000",
      };

      expect(scheme.id).toBeDefined();
    });
  });

  describe("SectionRegistration (v16)", () => {
    it("should accept a valid section registration object", () => {
      const reg: SectionRegistration = {
        id: "b1c2d3e4-0000-0000-0000-000000000001",
        registrant: { id: "guid-person" },
        section: { id: "guid-section" },
        status: { registrationStatus: "registered" },
        credit: { measure: "credit", minimum: 3, maximum: 3 },
        gradeScheme: { id: "guid-scheme" },
        grades: [
          { type: "final", grade: { id: "guid-grade-a" }, submittedOn: "2024-12-15" },
        ],
        involvement: { startOn: "2024-08-19", endOn: "2024-12-13" },
        academicLevel: { id: "guid-undergrad" },
        originallyRegisteredOn: "2024-04-01",
      };

      expect(reg.registrant.id).toBe("guid-person");
      expect(reg.status?.registrationStatus).toBe("registered");
      expect(reg.grades).toHaveLength(1);
    });

    it("should accept a minimal section registration object", () => {
      const reg: SectionRegistration = {
        id: "00000000-0000-0000-0000-000000000000",
        registrant: { id: "guid-person" },
        section: { id: "guid-section" },
      };

      expect(reg.section.id).toBeDefined();
    });
  });

  describe("InstructionalEvent (v11)", () => {
    it("should accept a valid instructional event object", () => {
      const event: InstructionalEvent = {
        id: "c1d2e3f4-0000-0000-0000-000000000001",
        section: { id: "guid-section" },
        instructionalMethod: { id: "guid-lecture" },
        recurrence: {
          repeatRule: {
            type: "weekly",
            daysOfWeek: ["monday", "wednesday", "friday"],
          },
        },
        locations: [{ location: { id: "guid-room-101", title: "Room 101" } }],
        instructors: [
          {
            instructor: { id: "guid-instructor" },
            instructorRole: "primary",
            workLoadPercentage: 100,
          },
        ],
        startOn: "08:00:00",
        endOn: "08:50:00",
      };

      expect(event.section.id).toBe("guid-section");
      expect(event.instructors).toHaveLength(1);
      expect(event.recurrence?.repeatRule?.daysOfWeek).toHaveLength(3);
    });

    it("should accept a minimal instructional event object", () => {
      const event: InstructionalEvent = {
        id: "00000000-0000-0000-0000-000000000000",
        section: { id: "guid-section" },
      };

      expect(event.section.id).toBeDefined();
    });
  });

  describe("StudentAcademicCredential (v1)", () => {
    it("should accept a valid student academic credential object", () => {
      const cred: StudentAcademicCredential = {
        id: "d1e2f3a4-0000-0000-0000-000000000001",
        student: { id: "guid-student" },
        credential: { id: "guid-bs-degree" },
        earnedOn: "2024-05-15",
        academicLevel: { id: "guid-undergrad" },
        academicPeriod: { id: "guid-spring-2024" },
        disciplines: [
          { discipline: { id: "guid-cs" }, type: "major" },
          { discipline: { id: "guid-math" }, type: "minor" },
        ],
        recognitions: [{ type: "honors", detail: { id: "guid-magna" } }],
        cumulativeGradePointAverage: 3.75,
      };

      expect(cred.student.id).toBe("guid-student");
      expect(cred.disciplines).toHaveLength(2);
      expect(cred.cumulativeGradePointAverage).toBe(3.75);
    });

    it("should accept a minimal student academic credential object", () => {
      const cred: StudentAcademicCredential = {
        id: "00000000-0000-0000-0000-000000000000",
        student: { id: "guid-student" },
      };

      expect(cred.student.id).toBeDefined();
    });
  });

  describe("FinancialAidApplication (v9)", () => {
    it("should accept a valid financial aid application object", () => {
      const app: FinancialAidApplication = {
        id: "e1f2a3b4-0000-0000-0000-000000000001",
        applicant: { id: "guid-person" },
        aidYear: { id: "guid-2024-2025" },
        methodology: "federal",
        expectedFamilyContribution: 5000,
        totalEstimatedCostOfAttendance: 25000,
        totalNeed: 20000,
      };

      expect(app.applicant.id).toBe("guid-person");
      expect(app.expectedFamilyContribution).toBe(5000);
    });

    it("should accept a minimal financial aid application object", () => {
      const app: FinancialAidApplication = {
        id: "00000000-0000-0000-0000-000000000000",
        applicant: { id: "guid-person" },
        aidYear: { id: "guid-year" },
      };

      expect(app.aidYear.id).toBeDefined();
    });
  });

  describe("FinancialAidAward", () => {
    it("should accept a valid financial aid award object", () => {
      const award: FinancialAidAward = {
        id: "f1a2b3c4-0000-0000-0000-000000000001",
        student: { id: "guid-student" },
        aidYear: { id: "guid-2024-2025" },
        fund: { id: "guid-pell-grant" },
        amount: 6895,
        status: "accepted",
      };

      expect(award.amount).toBe(6895);
      expect(award.status).toBe("accepted");
    });
  });

  describe("FinancialAidFund", () => {
    it("should accept a valid financial aid fund object", () => {
      const fund: FinancialAidFund = {
        id: "a2b3c4d5-0000-0000-0000-000000000001",
        code: "PELL",
        title: "Federal Pell Grant",
        category: "grant",
        source: "federal",
      };

      expect(fund.code).toBe("PELL");
      expect(fund.category).toBe("grant");
    });
  });

  describe("AccountingString (v12)", () => {
    it("should accept a valid accounting string object", () => {
      const acctStr: AccountingString = {
        id: "b2c3d4e5-0000-0000-0000-000000000001",
        accountingString: "11-00-1000-50000",
        description: "General fund operating account",
        components: [
          { id: "comp-1", value: "11", type: "fund" },
          { id: "comp-2", value: "1000", type: "organization" },
        ],
        status: "available",
      };

      expect(acctStr.accountingString).toBe("11-00-1000-50000");
      expect(acctStr.components).toHaveLength(2);
    });
  });

  describe("LedgerActivity", () => {
    it("should accept a valid ledger activity object", () => {
      const activity: LedgerActivity = {
        id: "c3d4e5f6-0000-0000-0000-000000000001",
        accountingString: { id: "guid-acct-string" },
        fiscalYear: { id: "guid-fy-2024" },
        type: "actual",
        transactionDate: "2024-03-15",
        amount: { value: 1500.0, currency: "USD" },
        description: "Tuition revenue posting",
      };

      expect(activity.type).toBe("actual");
      expect(activity.amount?.value).toBe(1500.0);
    });
  });

  describe("Employee (v12)", () => {
    it("should accept a valid employee object", () => {
      const emp: Employee = {
        id: "d4e5f6a7-0000-0000-0000-000000000001",
        person: { id: "guid-person" },
        status: "active",
        contract: { type: "fullTime" },
        startOn: "2020-01-15",
        homeDepartment: { id: "guid-cs-dept" },
      };

      expect(emp.person.id).toBe("guid-person");
      expect(emp.status).toBe("active");
    });

    it("should accept a minimal employee object", () => {
      const emp: Employee = {
        id: "00000000-0000-0000-0000-000000000000",
        person: { id: "guid-person" },
      };

      expect(emp.person.id).toBeDefined();
    });
  });

  describe("Position (v12)", () => {
    it("should accept a valid position object", () => {
      const pos: Position = {
        id: "e5f6a7b8-0000-0000-0000-000000000001",
        code: "PROF-CS-001",
        title: "Associate Professor of Computer Science",
        department: { id: "guid-cs-dept" },
        status: "active",
        exemptionType: "exempt",
        startOn: "2015-08-01",
      };

      expect(pos.code).toBe("PROF-CS-001");
      expect(pos.title).toBe("Associate Professor of Computer Science");
    });
  });

  describe("Job (v12)", () => {
    it("should accept a valid job object", () => {
      const job: Job = {
        id: "f6a7b8c9-0000-0000-0000-000000000001",
        person: { id: "guid-person" },
        position: { id: "guid-position" },
        department: { id: "guid-cs-dept" },
        title: "Associate Professor",
        status: "active",
        primary: true,
        startOn: "2020-08-15",
        fullTimeEquivalency: 1.0,
        payClass: "salary",
      };

      expect(job.person.id).toBe("guid-person");
      expect(job.primary).toBe(true);
      expect(job.fullTimeEquivalency).toBe(1.0);
    });

    it("should accept a minimal job object", () => {
      const job: Job = {
        id: "00000000-0000-0000-0000-000000000000",
        person: { id: "guid-person" },
      };

      expect(job.person.id).toBeDefined();
    });
  });
});
