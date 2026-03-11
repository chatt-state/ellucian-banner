import { describe, it, expect } from "vitest";
import type {
  Person,
  Student,
  Course,
  Section,
  AcademicPeriod,
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
});
