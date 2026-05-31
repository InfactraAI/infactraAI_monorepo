import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/* 
   EMPLOYEE INTERFACE
*/
interface Employee {

  srNo: number;

  empId: string;

  name: string;

  fatherName: string;

  doj: string;

  dept: string;

  gender: string;

  attendance: {
    [key: number]: string;
  };

  p: number;
  a: number;
  hd: number;
  ot: number;
  wo: number;
  co: number;
  cl: number;
  sun: number;
  hld: number;
  payable: number;
}

/* 
   SNAPSHOT INTERFACE
*/
interface SnapshotCard {

  title: string;

  value: number;

  icon: string;

  color: string;

  change: string;

  subtitle: string;

  isUp: boolean;
}

/* 
   COMPONENT
 */
@Component({
  selector: 'app-attendance',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './attendance.html',

  styleUrls: ['./attendance.css']
})

export class AttendanceComponent implements OnInit {

  /* 
     STORAGE KEY
   */
  private readonly STORAGE_KEY =
    'attendance_data_v2';

  /* 
     DATE CONFIG
   */
  year: number = 2026;

  monthName: string = 'April';

  days: number[] =
    Array.from(
      { length: 30 },
      (_, i) => i + 1
    );

  sundays: number[] = [
    5,
    12,
    19,
    26
  ];

  dayNames: string[] = [

    'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri',
    'Sat', 'Sun', 'Mon', 'Tue', 'Wed',
    'Thu', 'Fri', 'Sat', 'Sun', 'Mon',
    'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu'

  ];

  /* 
     MAIN DATA
   */
  employees: Employee[] = [];

  snapshotCards: SnapshotCard[] = [];

  /* 
     INIT
  */
  ngOnInit(): void {

    this.loadData();

    this.updateSnapshots();
  }

  /* 
     LOAD STORAGE DATA
  */
  loadData(): void {

    const savedData =
      localStorage.getItem(
        this.STORAGE_KEY
      );

    if (savedData) {

      this.employees =
        JSON.parse(savedData);

    } else {

      this.initializeEmployees();

    }
  }

  /* 
     INITIALIZE EMPLOYEES
  */
  initializeEmployees(): void {

    const firstEmployee =
      this.createEmployee(1);

    firstEmployee.empId = '211';

    firstEmployee.name =
      'Saurabh Kumar Kori';

    firstEmployee.fatherName = 'N/A';

    firstEmployee.doj =
      '13.09.2023';

    firstEmployee.dept = 'MI';

    firstEmployee.gender = 'M';

    this.employees.push(
      firstEmployee
    );

    for (let i = 2; i <= 20; i++) {

      this.employees.push(
        this.createEmployee(i)
      );
    }

    this.saveToStorage();
  }

  /* 
     CREATE EMPTY EMPLOYEE
  */
  createEmployee(
    srNo: number
  ): Employee {

    const attendance:
      { [key: number]: string } = {};

    this.days.forEach(day => {

      attendance[day] =
        this.sundays.includes(day)
          ? 'WO'
          : '';

    });

    return {

      srNo,

      empId: '',

      name: '',

      fatherName: '',

      doj: '',

      dept: '',

      gender: '',

      attendance,

      p: 0,

      a: 0,

      hd: 0,

      ot: 0,

      wo: 0,

      co: 0,

      cl: 0,

      sun: 0,

      hld: 0,

      payable: 0
    };
  }

  /* 
     UPDATE CELL
   */
  updateCell(
    emp: Employee
  ): void {

    let present = 0;

    let absent = 0;

    let weekOff = 0;

    let halfDay = 0;

    let casualLeave = 0;

    this.days.forEach(day => {

      const value =
        emp.attendance[day]
          ?.trim()
          ?.toUpperCase();

      switch (value) {

        case 'P':

          present++;

          break;

        case 'A':

          absent++;

          break;

        case 'WO':

        case 'SUN':

          weekOff++;

          break;

        case 'HD':

          halfDay += 0.5;

          break;

        case 'CL':

          casualLeave++;

          break;
      }

    });

    emp.p = present;

    emp.a = absent;

    emp.wo = weekOff;

    emp.hd = halfDay;

    emp.cl = casualLeave;

    emp.payable =
      present +
      weekOff +
      casualLeave +
      halfDay;

    this.saveToStorage();

    this.updateSnapshots();
  }

  /* 
     UPDATE SNAPSHOTS
  */
  updateSnapshots(): void {

    const totalPresent =
      this.employees.reduce(
        (sum, emp) => sum + emp.p,
        0
      );

    const totalAbsent =
      this.employees.reduce(
        (sum, emp) => sum + emp.a,
        0
      );

    const totalPayable =
      this.employees.reduce(
        (sum, emp) => sum + emp.payable,
        0
      );

    const activeStaff =
      this.employees.filter(
        emp =>
          emp.name.trim() !== ''
      ).length;

    this.snapshotCards = [

      {
        title: 'Total Present',

        value: totalPresent,

        icon: 'groups',

        color: 'blue',

        change: '3.2%',

        subtitle: 'vs last month',

        isUp: true
      },

      {
        title: 'Total Absent',

        value: totalAbsent,

        icon: 'person_off',

        color: 'green',

        change: '2.1%',

        subtitle: 'vs last month',

        isUp: false
      },

      {
        title: 'Net Payable Days',

        value: totalPayable,

        icon: 'payments',

        color: 'orange',

        change: '5.4%',

        subtitle: 'vs last month',

        isUp: true
      },

      {
        title: 'Active Staff',

        value: activeStaff,

        icon: 'badge',

        color: 'purple',

        change: '0%',

        subtitle: 'Current Month',

        isUp: true
      }

    ];
  }

  /* 
     SAVE TO LOCAL STORAGE
 */
  saveToStorage(): void {

    localStorage.setItem(

      this.STORAGE_KEY,

      JSON.stringify(
        this.employees
      )
    );
  }

  /* 
     CELL COLOR
  */
  getCellColor(
    value: string
  ): string {

    if (!value) {

      return 'transparent';
    }

    switch (
      value.toUpperCase()
    ) {

      case 'P':

        return '#dcfce7';

      case 'A':

        return '#fee2e2';

      case 'WO':

      case 'SUN':

        return '#f1f5f9';

      case 'HD':

        return '#fef9c3';

      case 'CL':

        return '#ede9fe';

      default:

        return 'transparent';
    }
  }

  /* 
     CLEAR SHEET
  */
  clearSheet(): void {

    const confirmDelete =
      confirm(
        'Are you sure you want to clear all attendance data?'
      );

    if (!confirmDelete) {

      return;
    }

    localStorage.removeItem(
      this.STORAGE_KEY
    );

    this.employees = [];

    this.initializeEmployees();

    this.updateSnapshots();
  }

}
